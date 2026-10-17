// Fallback headline source. Google News answers Cloudflare's network with a 503,
// so on the deployed Worker the AP feed comes from Bing News RSS instead. Bing
// returns about a dozen items per query, so a few legislation queries are merged.

import type { APItem } from "./ap-news.functions";

const QUERIES = ["legislation", "bill congress", "lawmakers", "senate bill", "governor signs bill"];
const UA = "Mozilla/5.0 BillBreaker";

function feedUrl(query: string) {
  const q = encodeURIComponent(`site:apnews.com ${query}`);
  return `https://www.bing.com/news/search?q=${q}&qft=sortbydate%3d%221%22&format=rss`;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function unescape(s: string) {
  return s.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m);
}

function tag(name: string, block: string) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m ? unescape(m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()) : "";
}

/** Bing wraps each story in an apiclick.aspx redirect; the article sits in `url`. */
export function unwrapBingLink(link: string): string | null {
  try {
    const target = new URL(link).searchParams.get("url");
    if (!target) return null;
    const host = new URL(target).hostname;
    return host === "apnews.com" || host.endsWith(".apnews.com") ? target : null;
  } catch {
    return null;
  }
}

async function fetchQuery(query: string): Promise<APItem[]> {
  const res = await fetch(feedUrl(query), { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const xml = await res.text();
  return xml
    .split("<item>")
    .slice(1)
    .flatMap((b) => {
      const block = b.split("</item>")[0];
      const link = unwrapBingLink(tag("link", block));
      const title = tag("title", block);
      if (!link || !title) return [];
      return [{ title, link, pubDate: tag("pubDate", block), source: "AP News" }];
    });
}

export async function fetchBingApItems(limit = 40): Promise<APItem[]> {
  const batches = await Promise.allSettled(QUERIES.map(fetchQuery));
  const seen = new Set<string>();
  const items: APItem[] = [];
  for (const b of batches) {
    if (b.status !== "fulfilled") continue;
    for (const it of b.value) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      items.push(it);
    }
  }
  items.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return items.slice(0, limit);
}
