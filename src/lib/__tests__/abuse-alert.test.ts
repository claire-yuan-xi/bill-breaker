import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mock the admin client used by rate-limit.server.ts ---
type RpcCall = { identifier: string; limit: number; windowSeconds: number };
const rpcCalls: RpcCall[] = [];
// Stateful counters so "incident count" can climb across calls within a test.
const incidentCounts = new Map<string, number>();
// Stateful cooldown: once an alert for an identifier fires, the next bump
// returns allowed=false until the test resets state.
const cooldownFired = new Set<string>();
let rpcShouldError = false;

const insertedEvents: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (
      _name: string,
      args: { _identifier: string; _window_seconds: number; _limit: number },
    ) => {
      rpcCalls.push({
        identifier: args._identifier,
        limit: args._limit,
        windowSeconds: args._window_seconds,
      });
      if (rpcShouldError) {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      }
      if (args._identifier.startsWith("abuse-alert:")) {
        // cooldown bump: limit=1; allowed only on first hit.
        const fired = cooldownFired.has(args._identifier);
        cooldownFired.add(args._identifier);
        return Promise.resolve({
          data: [
            {
              current_count: fired ? 2 : 1,
              window_end: new Date(Date.now() + 3600_000).toISOString(),
              allowed: !fired,
            },
          ],
          error: null,
        });
      }
      const prev = incidentCounts.get(args._identifier) ?? 0;
      const next = prev + 1;
      incidentCounts.set(args._identifier, next);
      return Promise.resolve({
        data: [
          {
            current_count: next,
            window_end: new Date(Date.now() + 60_000).toISOString(),
            allowed: next <= args._limit,
          },
        ],
        error: null,
      });
    },
    from: (_table: string) => ({
      insert: (row: Record<string, unknown>) => {
        insertedEvents.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  rpcCalls.length = 0;
  insertedEvents.length = 0;
  incidentCounts.clear();
  cooldownFired.clear();
  rpcShouldError = false;
  fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  process.env.ABUSE_ALERT_WEBHOOK_URL = "https://hooks.example.com/abuse";
  process.env.ABUSE_ALERT_THRESHOLD = "5";
  process.env.ABUSE_ALERT_COOLDOWN_S = "3600";
  delete process.env.SUPABASE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ABUSE_ALERT_WEBHOOK_URL;
  delete process.env.ABUSE_ALERT_THRESHOLD;
  delete process.env.ABUSE_ALERT_COOLDOWN_S;
});

const { maybeAlert, postWebhookWithRetry } = await import("../rate-limit.server");

describe("maybeAlert — threshold gating", () => {
  it("does NOT fire below the threshold", async () => {
    for (let i = 0; i < 4; i++) {
      await maybeAlert({
        identifier: "ip:1.2.3.4",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fires exactly once when the threshold is reached", async () => {
    for (let i = 0; i < 5; i++) {
      await maybeAlert({
        identifier: "ip:1.2.3.4",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/abuse");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.identifier).toBe("ip:1.2.3.4");
    expect(body.incident_count).toBeGreaterThanOrEqual(5);
    expect(body.threshold).toBe(5);
  });

  it("respects per-identifier cooldown — does NOT fire again until cooldown elapses", async () => {
    for (let i = 0; i < 10; i++) {
      await maybeAlert({
        identifier: "ip:9.9.9.9",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    // Only the first crossing of the threshold should produce a webhook call;
    // subsequent calls are blocked by the cooldown RPC returning allowed=false.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("different identifiers have independent cooldowns", async () => {
    for (let i = 0; i < 5; i++) {
      await maybeAlert({
        identifier: "ip:A",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    for (let i = 0; i < 5; i++) {
      await maybeAlert({
        identifier: "ip:B",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when ABUSE_ALERT_WEBHOOK_URL is missing", async () => {
    delete process.env.ABUSE_ALERT_WEBHOOK_URL;
    for (let i = 0; i < 10; i++) {
      await maybeAlert({
        identifier: "ip:no-config",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op when ABUSE_ALERT_WEBHOOK_URL is not a valid https URL", async () => {
    process.env.ABUSE_ALERT_WEBHOOK_URL = "ftp://nope";
    for (let i = 0; i < 10; i++) {
      await maybeAlert({
        identifier: "ip:bad-url",
        limit: 10,
        windowSeconds: 60,
        count: 11,
        reason: "limit_exceeded",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("custom threshold from env is honored", async () => {
    process.env.ABUSE_ALERT_THRESHOLD = "2";
    await maybeAlert({
      identifier: "ip:thr",
      limit: 10,
      windowSeconds: 60,
      count: 11,
      reason: "limit_exceeded",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await maybeAlert({
      identifier: "ip:thr",
      limit: 10,
      windowSeconds: 60,
      count: 11,
      reason: "limit_exceeded",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("postWebhookWithRetry — retry / backoff / safe failure", () => {
  it("returns ok on first 2xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await postWebhookWithRetry("https://x.example/y", { hi: 1 }, { baseDelayMs: 1 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it("retries on 5xx then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await postWebhookWithRetry(
      "https://x.example/y",
      {},
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it("does NOT retry on 4xx (except 408/429)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 400 }));
    const r = await postWebhookWithRetry(
      "https://x.example/y",
      {},
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(1);
    expect(r.status).toBe(400);
  });

  it("retries on 429", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const r = await postWebhookWithRetry(
      "https://x.example/y",
      {},
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it("gives up after N attempts without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const r = await postWebhookWithRetry(
      "https://x.example/y",
      {},
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(3);
    expect(r.error).toBeDefined();
  });
});

describe("maybeAlert — failure isolation", () => {
  it("webhook 5xx failures don't throw to the caller", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    await expect(
      (async () => {
        for (let i = 0; i < 5; i++) {
          await maybeAlert({
            identifier: "ip:fail",
            limit: 10,
            windowSeconds: 60,
            count: 11,
            reason: "limit_exceeded",
          });
        }
      })(),
    ).resolves.toBeUndefined();
  });
});
