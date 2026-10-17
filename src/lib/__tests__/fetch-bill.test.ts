import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
  delete process.env.OPENSTATES_API_KEY;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("fetchBillTextFromSources — multi-source chain", () => {
  it("returns Congress.gov text and stops there on success", async () => {
    const congressBody =
      "<html><body><pre>" + "Lorem ipsum bill text. ".repeat(50) + "</pre></body></html>";
    globalThis.fetch = vi.fn(
      async () =>
        new Response(congressBody, { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;

    const { fetchBillTextFromSources } = await import("../fetch-bill.server");
    const r = await fetchBillTextFromSources({ state: "US", billNo: "HR1" });
    expect("text" in r && r.text !== null).toBe(true);
    if ("source" in r) {
      expect(r.source).toBe("congress.gov");
      expect(r.tried).toContain("congress.gov");
    }
  });

  it("falls through to GovInfo when Congress.gov returns 404", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("congress.gov")) return new Response("", { status: 404 });
      if (u.includes("govinfo.gov")) {
        return new Response("<html><body>" + "Govinfo content. ".repeat(60) + "</body></html>", {
          status: 200,
        });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    const { fetchBillTextFromSources } = await import("../fetch-bill.server");
    const r = await fetchBillTextFromSources({ state: "US", billNo: "HR1" });
    expect("source" in r && r.source).toBe("govinfo");
    if ("tried" in r) {
      expect(r.tried).toEqual(["congress.gov", "govinfo"]);
    }
    expect(calls.some((u) => u.includes("congress.gov"))).toBe(true);
    expect(calls.some((u) => u.includes("govinfo.gov"))).toBe(true);
  });

  it("returns tried sources and null text when all fail", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("", { status: 500 }),
    ) as unknown as typeof fetch;
    const { fetchBillTextFromSources } = await import("../fetch-bill.server");
    const r = await fetchBillTextFromSources({ state: "US", billNo: "HR1" });
    expect("text" in r && r.text).toBeNull();
    expect(r.tried.length).toBeGreaterThanOrEqual(2);
  });

  it("skips OpenStates silently when API key is absent (non-federal)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    const { fetchBillTextFromSources } = await import("../fetch-bill.server");
    const r = await fetchBillTextFromSources({ state: "CA", billNo: "AB100" });
    expect("text" in r && r.text).toBeNull();
    expect(r.tried).toEqual(["openstates"]);
  });

  it("activates OpenStates and returns bill text when OPENSTATES_API_KEY is set", async () => {
    process.env.OPENSTATES_API_KEY = "test-key";
    const longText = "OpenStates body. ".repeat(60);
    globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("v3.openstates.org/bills")) {
        // Caller must send the API key header.
        const headers = (init?.headers ?? {}) as Record<string, string>;
        if (headers["X-API-KEY"] !== "test-key") {
          return new Response("missing key", { status: 401 });
        }
        return new Response(
          JSON.stringify({
            results: [
              {
                versions: [
                  { links: [{ url: "https://leginfo.ca.gov/text", media_type: "text/html" }] },
                ],
                sources: [{ url: "https://leginfo.ca.gov/bill" }],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (u.includes("leginfo.ca.gov/text")) {
        return new Response(`<html><body>${longText}</body></html>`, { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const { fetchBillTextFromSources } = await import("../fetch-bill.server");
    const r = await fetchBillTextFromSources({ state: "CA", billNo: "AB100" });
    expect("source" in r && r.source).toBe("openstates");
    if ("tried" in r) expect(r.tried).toEqual(["openstates"]);
    if ("text" in r && r.text) expect(r.text.length).toBeGreaterThan(400);
  });
});
