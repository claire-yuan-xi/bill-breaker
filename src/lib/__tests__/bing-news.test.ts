import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBingApItems, unwrapBingLink } from "../bing-news.server";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const click = (target: string) =>
  `http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=${encodeURIComponent(target)}&amp;mkt=en-us`;

function feed(items: Array<{ title: string; url: string; date: string }>) {
  const body = items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${click(i.url)}</link><pubDate>${i.date}</pubDate></item>`,
    )
    .join("");
  return `<?xml version="1.0"?><rss><channel>${body}</channel></rss>`;
}

describe("unwrapBingLink", () => {
  it("returns the AP article behind the Bing redirect", () => {
    const link = click("https://apnews.com/article/abc").replace(/&amp;/g, "&");
    expect(unwrapBingLink(link)).toBe("https://apnews.com/article/abc");
  });

  it("drops links that do not point at apnews.com", () => {
    const link = click("https://example.com/story").replace(/&amp;/g, "&");
    expect(unwrapBingLink(link)).toBeNull();
    expect(unwrapBingLink("not a url")).toBeNull();
  });
});

describe("fetchBingApItems", () => {
  it("merges queries, removes duplicates and sorts newest first", async () => {
    const xml = feed([
      {
        title: "Older &amp; quieter",
        url: "https://apnews.com/article/old",
        date: "Mon, 12 Oct 2026 10:00:00 GMT",
      },
      {
        title: "Newest",
        url: "https://apnews.com/article/new",
        date: "Sat, 17 Oct 2026 08:00:00 GMT",
      },
    ]);
    globalThis.fetch = vi.fn(async () => new Response(xml)) as typeof fetch;

    const items = await fetchBingApItems();

    expect(items.map((i) => i.link)).toEqual([
      "https://apnews.com/article/new",
      "https://apnews.com/article/old",
    ]);
    expect(items[1].title).toBe("Older & quieter");
  });

  it("returns nothing when every query fails", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 503 })) as typeof fetch;
    expect(await fetchBingApItems()).toEqual([]);
  });
});
