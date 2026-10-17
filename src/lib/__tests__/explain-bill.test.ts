import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (must come before importing the route) ---

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/lib/fetch-bill.server", () => ({
  fetchUSBillText: vi
    .fn()
    .mockResolvedValue({ text: "x".repeat(500), sourceUrl: "https://example" }),
  fetchBillTextFromSources: vi.fn().mockResolvedValue({
    text: "x".repeat(500),
    sourceUrl: "https://example",
    source: "congress.gov",
    tried: ["congress.gov"],
  }),
}));

process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_PUBLISHABLE_KEY = "pk";
process.env.GEMINI_API_KEY = "test-key";

const { Route } = await import("@/routes/api/explain-bill");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const POST: (ctx: { request: Request }) => Promise<Response> = (Route as any).options.server
  .handlers.POST;

function emptyCacheChain() {
  // Returns a chain where .maybeSingle() resolves to { data: null }.
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.gt = passthrough;
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null });
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  return chain;
}

function makeReq(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/explain-bill", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/explain-bill — anonymous access + validation", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation(() => emptyCacheChain());
  });

  it("rejects an invalid US state with 400", async () => {
    const res = await POST({ request: makeReq({ state: "ZZ", billNo: "HR1", text: "" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/state/i);
  });

  it("rejects a malformed bill number with 400", async () => {
    const res = await POST({ request: makeReq({ state: "US", billNo: "💣💣💣", text: "" }) });
    expect(res.status).toBe(400);
  });

  it("rejects oversize text with 413", async () => {
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "a".repeat(200_001) }),
    });
    expect(res.status).toBe(413);
  });

  it("does NOT require an Authorization header (anonymous, public endpoint)", async () => {
    // Cache hit → returns SSE 200 without checking auth.
    fromMock.mockImplementationOnce(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = passthrough;
      chain.eq = passthrough;
      chain.gt = passthrough;
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: {
          payload: {
            title: "Cached",
            sourceUrl: null,
            sections: [{ event: "quick_take", data: { tldr: "ok" } }],
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      return chain;
    });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300) }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/event-stream/);
  });
});

describe("POST /api/explain-bill — IP rate limiting", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation(() => emptyCacheChain());
  });

  it("returns 429 with Retry-After when the per-minute IP limit is exceeded", async () => {
    const windowEnd = new Date(Date.now() + 42_000).toISOString();
    rpcMock.mockResolvedValueOnce({
      data: [{ current_count: 16, window_end: windowEnd, allowed: false }],
      error: null,
    });
    const res = await POST({
      request: makeReq(
        { state: "US", billNo: "HR1", text: "x".repeat(300) },
        { "cf-connecting-ip": "203.0.113.1" },
      ),
    });
    expect(res.status).toBe(429);
    const retry = Number(res.headers.get("Retry-After"));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
  });

  it("fails closed (429) when the rate-limit RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300) }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

describe("POST /api/explain-bill — JSON fallback mode", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    fromMock.mockImplementation(() => emptyCacheChain());
  });

  it("returns application/json (not SSE) on validation failure when mode=json", async () => {
    const res = await POST({
      request: makeReq({ state: "ZZ", billNo: "HR1", text: "", mode: "json" }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
  });

  it("serves a JSON object from cache when mode=json", async () => {
    fromMock.mockImplementationOnce(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = passthrough;
      chain.eq = passthrough;
      chain.gt = passthrough;
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: {
          payload: {
            title: "Cached bill",
            sourceUrl: "https://example",
            sections: [{ event: "quick_take", data: { tldr: "hi" } }],
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      return chain;
    });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300), mode: "json" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Cached bill");
    expect(body.cached).toBe(true);
    expect(body.quick_take).toEqual({ tldr: "hi" });
  });
});

describe("POST /api/explain-bill — stale cache fallback", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it("serves the most recent prior analysis when the live AI pipeline fails", async () => {
    // Fresh-cache lookup → miss (first call).
    // Rate-limit RPC → allowed.
    rpcMock.mockResolvedValue({
      data: [
        {
          current_count: 1,
          window_end: new Date(Date.now() + 60_000).toISOString(),
          allowed: true,
        },
      ],
      error: null,
    });
    // Mock Gemini to fail every request.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("oops", { status: 503 }) as unknown as Response);

    const callIndex = { i: 0 };
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = passthrough;
      chain.eq = passthrough;
      chain.gt = passthrough;
      chain.order = passthrough;
      chain.limit = passthrough;
      chain.upsert = vi.fn().mockResolvedValue({ error: null });
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        callIndex.i += 1;
        // 1st call = fresh cache lookup (miss).
        if (callIndex.i === 1) return Promise.resolve({ data: null });
        // 2nd call = stale fallback lookup (hit).
        return Promise.resolve({
          data: {
            payload: {
              title: "Old cached title",
              sourceUrl: "https://old",
              sections: [{ event: "quick_take", data: { tldr: "old summary" } }],
            },
            created_at: new Date(Date.now() - 86_400_000).toISOString(),
          },
        });
      });
      return chain;
    });

    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300), mode: "json" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached).toBe(true);
    expect(body.title).toBe("Old cached title");
    expect(body.cached_at).toBeTruthy();
    expect(body.quick_take).toEqual({ tldr: "old summary" });
    fetchSpy.mockRestore();
  });

  it("ignores an expired fresh cache row and falls back to stale-cache when AI fails", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          current_count: 1,
          window_end: new Date(Date.now() + 60_000).toISOString(),
          allowed: true,
        },
      ],
      error: null,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("nope", { status: 503 }) as unknown as Response);
    const callIndex = { i: 0 };
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = passthrough;
      chain.eq = passthrough;
      chain.order = passthrough;
      chain.limit = passthrough;
      chain.upsert = vi.fn().mockResolvedValue({ error: null });
      // `.gt("expires_at", now)` is part of the FRESH lookup chain. Simulate
      // that even though there is a row in bill_analyses for this bill, it
      // has already expired by returning `null` from the fresh-lookup, and
      // returning a stale row from the un-filtered lookup.
      chain.gt = passthrough;
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        callIndex.i += 1;
        if (callIndex.i === 1) return Promise.resolve({ data: null }); // fresh miss (expired)
        return Promise.resolve({
          data: {
            payload: {
              title: "Stale",
              sourceUrl: null,
              sections: [{ event: "quick_take", data: { tldr: "old" } }],
            },
            created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
          },
        });
      });
      return chain;
    });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300), mode: "json" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached).toBe(true);
    expect(body.cached_at).toBeTruthy();
    // 5 days old
    const ageMs = Date.now() - new Date(String(body.cached_at)).getTime();
    expect(ageMs).toBeGreaterThan(86_400_000);
    fetchSpy.mockRestore();
  });

  it("returns cached_reason='ai_unavailable' when Gemini rejects the request", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          current_count: 1,
          window_end: new Date(Date.now() + 60_000).toISOString(),
          allowed: true,
        },
      ],
      error: null,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("permission denied", { status: 403 }) as unknown as Response);
    let i = 0;
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = chain.eq = chain.gt = chain.order = chain.limit = passthrough;
      chain.upsert = vi.fn().mockResolvedValue({ error: null });
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        i += 1;
        if (i === 1) return Promise.resolve({ data: null });
        return Promise.resolve({
          data: {
            payload: { title: "Stale", sourceUrl: null, sections: [] },
            created_at: new Date(Date.now() - 3600_000).toISOString(),
          },
        });
      });
      return chain;
    });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300), mode: "json" }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached_reason).toBe("ai_unavailable");
    fetchSpy.mockRestore();
  });

  it("returns cached_reason='rate_limited' when Gemini returns 429", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          current_count: 1,
          window_end: new Date(Date.now() + 60_000).toISOString(),
          allowed: true,
        },
      ],
      error: null,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("slow down", { status: 429 }) as unknown as Response);
    let i = 0;
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = chain.eq = chain.gt = chain.order = chain.limit = passthrough;
      chain.upsert = vi.fn().mockResolvedValue({ error: null });
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        i += 1;
        if (i === 1) return Promise.resolve({ data: null });
        return Promise.resolve({
          data: {
            payload: { title: "Stale", sourceUrl: null, sections: [] },
            created_at: new Date(Date.now() - 120_000).toISOString(),
          },
        });
      });
      return chain;
    });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300), mode: "json" }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cached_reason).toBe("rate_limited");
    fetchSpy.mockRestore();
  });

  it("returns 503 when neither fresh nor stale cache exists and AI fails", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          current_count: 1,
          window_end: new Date(Date.now() + 60_000).toISOString(),
          allowed: true,
        },
      ],
      error: null,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("err", { status: 503 }) as unknown as Response);
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.select = chain.eq = chain.gt = chain.order = chain.limit = passthrough;
      chain.upsert = vi.fn().mockResolvedValue({ error: null });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null });
      return chain;
    });
    const res = await POST({
      request: makeReq({ state: "US", billNo: "HR1", text: "x".repeat(300), mode: "json" }),
    });
    expect(res.status).toBe(503);
    fetchSpy.mockRestore();
  });
});
