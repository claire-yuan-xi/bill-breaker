import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const realFetch = globalThis.fetch;
const LINK = "https://news.google.com/rss/articles/CBMiAbC123?oc=5";
const AP = "https://apnews.com/article/senate-budget-vote-abc123";

beforeEach(() => vi.resetModules());
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockGoogle(batchBody: string) {
  const fn = vi.fn(async (url: string | URL, _init?: RequestInit) => {
    if (String(url).includes("batchexecute")) return new Response(batchBody);
    return new Response('<div data-n-a-sg="SIG" data-n-a-ts="1729150000"></div>');
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("decodeGoogleNewsLink", () => {
  it("returns the publisher URL from a batchexecute reply", async () => {
    const row = JSON.stringify([
      ["wrb.fr", "Fbv4je", JSON.stringify(["garturlres", AP, 1]), null, null, null, "generic"],
    ]);
    const fn = mockGoogle(`)]}'\n\n${row.length}\n${row}\n25\n[["di",42]]`);
    const { decodeGoogleNewsLink } = await import("../google-news.server");
    expect(await decodeGoogleNewsLink(LINK)).toBe(AP);
    const body = String(fn.mock.calls[1][1]?.body);
    expect(decodeURIComponent(body)).toContain("CBMiAbC123");
    expect(decodeURIComponent(body)).toContain("SIG");
    // Cached: no more fetches on a second call.
    await decodeGoogleNewsLink(LINK);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns null for a garbled reply and for non-Google links", async () => {
    mockGoogle(")]}'\n\nnonsense");
    const { decodeGoogleNewsLink } = await import("../google-news.server");
    expect(await decodeGoogleNewsLink(LINK)).toBeNull();
    expect(await decodeGoogleNewsLink(AP)).toBeNull();
  });
});
