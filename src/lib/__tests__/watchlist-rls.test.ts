import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock supabaseAdmin to observe what the server functions query ---

type Call = { table: string; op: string; args: unknown[]; filters: Array<[string, unknown]> };
const calls: Call[] = [];
let nextSelectRows: unknown[] = [];

function makeChain(table: string, op: string, args: unknown[]) {
  const call: Call = { table, op, args, filters: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.order = passthrough;
  chain.limit = passthrough;
  chain.eq = (col: string, val: unknown) => {
    call.filters.push([col, val]);
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(op === "select" ? { data: nextSelectRows, error: null } : { error: null }).then(
      resolve,
    );
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (...a: unknown[]) => makeChain(table, "select", a),
      upsert: (...a: unknown[]) => makeChain(table, "upsert", a),
      delete: () => makeChain(table, "delete", []),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          current_count: 1,
          window_end: new Date(Date.now() + 60_000).toISOString(),
          allowed: true,
        },
      ],
      error: null,
    }),
  },
}));

// getRequest() is only used to extract an IP for rate limiting.
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("http://localhost/", { headers: { "cf-connecting-ip": "203.0.113.99" } }),
}));

process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_PUBLISHABLE_KEY = "pk";

const {
  _pullDeviceWatchlistImpl: pull,
  _pushDeviceWatchlistItemImpl: push,
  _removeDeviceWatchlistItemImpl: remove,
} = await import("../watchlist.functions");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  calls.length = 0;
  nextSelectRows = [];
});

describe("device_watchlist server functions — input validation (defense in depth)", () => {
  it("rejects malformed device ids", async () => {
    await expect(pull({ device_id: "not-a-uuid" })).rejects.toThrow();
    await expect(
      push({ device_id: "not-a-uuid", state: "US", bill_no: "HR1", title: "" }),
    ).rejects.toThrow();
    await expect(remove({ device_id: "💣", state: "US", bill_no: "HR1" })).rejects.toThrow();
  });

  it("rejects malformed state and bill numbers", async () => {
    await expect(
      push({ device_id: A, state: "United-States", bill_no: "HR1", title: "" }),
    ).rejects.toThrow();
    await expect(
      push({ device_id: A, state: "US", bill_no: "<script>", title: "" }),
    ).rejects.toThrow();
  });
});

describe("device_watchlist server functions — per-device row scoping", () => {
  it("pull only returns rows for the requesting device id", async () => {
    nextSelectRows = [
      { state: "US", bill_no: "HR1", title: "x", added_at: new Date().toISOString() },
    ];
    await pull({ device_id: A });
    const select = calls.find((c) => c.op === "select")!;
    expect(select.filters).toEqual([["device_id", A.toLowerCase()]]);
  });

  it("a different device id cannot read another device's rows", async () => {
    // Simulate the database having rows ONLY for device A. Server fn called
    // with B receives whatever the WHERE returns — we assert the WHERE was
    // scoped to B, so a real DB would have returned nothing.
    nextSelectRows = [];
    await pull({ device_id: B });
    const select = calls.find((c) => c.op === "select")!;
    expect(select.filters).toEqual([["device_id", B.toLowerCase()]]);
    expect(select.filters.some(([, v]) => v === A.toLowerCase())).toBe(false);
  });

  it("push upserts a row keyed by the caller's device id only", async () => {
    await push({ device_id: A, state: "US", bill_no: "HR1", title: "Test" });
    const upsert = calls.find((c) => c.op === "upsert")!;
    const row = upsert.args[0] as Record<string, unknown>;
    expect(row.device_id).toBe(A.toLowerCase());
    // No cross-device leakage: row.device_id must equal the input, never B.
    expect(row.device_id).not.toBe(B);
    expect(row.state).toBe("US");
    expect(row.bill_no).toBe("HR1");
  });

  it("remove only deletes rows matching (device_id, state, bill_no) for the caller", async () => {
    await remove({ device_id: A, state: "US", bill_no: "HR1" });
    const del = calls.find((c) => c.op === "delete")!;
    expect(del.filters).toEqual([
      ["device_id", A.toLowerCase()],
      ["state", "US"],
      ["bill_no", "HR1"],
    ]);
  });

  it("crafted state/bill input on B never produces a query touching A's rows", async () => {
    await remove({ device_id: B, state: "US", bill_no: "HR1" });
    const del = calls.find((c) => c.op === "delete")!;
    expect(del.filters.some(([col, val]) => col === "device_id" && val === A.toLowerCase())).toBe(
      false,
    );
  });
});
