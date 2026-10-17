import { createServerFn } from "@tanstack/react-start";
import { apSearchUrl, decodeGoogleNewsLink } from "./google-news.server";
import { fetchBingApItems } from "./bing-news.server";

export type APItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
};

// Google News RSS — filtered to apnews.com, legislation/bills/laws topics.
// Real-time, no API key required. Google's article links are decoded to the
// apnews.com URL here; any that won't decode fall back to an AP search for the headline.
const FEED_URL =
  "https://news.google.com/rss/search?q=(bill+OR+legislation+OR+law+OR+statute+OR+congress+OR+senate)+site:apnews.com&hl=en-US&gl=US&ceid=US:en";

function extract(tag: string, xml: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

async function fetchGoogleApItems(): Promise<APItem[]> {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": "Mozilla/5.0 BillBreaker" },
  });
  if (!res.ok) throw new Error(`Google News feed unavailable (${res.status})`);
  const xml = await res.text();
  const blocks = xml.split("<item>").slice(1);
  const raw = blocks.slice(0, 40).map((b) => {
    const block = "<item>" + b.split("</item>")[0] + "</item>";
    return {
      title: extract("title", block),
      link: extract("link", block),
      pubDate: extract("pubDate", block),
      source: extract("source", block) || "AP News",
    };
  });
  return Promise.all(
    raw.map(async (it) => ({
      ...it,
      link: (await decodeGoogleNewsLink(it.link)) ?? apSearchUrl(it.title.replace(/ - [^-]+$/, "")),
    })),
  );
}

// Google first (richest feed); Bing when Google refuses, as it does for Cloudflare Workers.
export const getLegislationNews = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: APItem[]; error: string | null }> => {
    try {
      const items = await fetchGoogleApItems();
      if (items.length) return { items, error: null };
    } catch {
      // fall through to Bing
    }
    try {
      const items = await fetchBingApItems();
      if (items.length) return { items, error: null };
      return { items: [], error: "No live headlines right now" };
    } catch (e) {
      console.error("AP feed error", e);
      return { items: [], error: "Could not load live headlines" };
    }
  },
);
