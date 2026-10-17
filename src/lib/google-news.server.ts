// Google News RSS links (news.google.com/rss/articles/<id>) no longer HTTP-redirect
// to the publisher. The page decodes the id with a batchexecute call, so a plain
// fetch with redirect: "follow" lands back on Google News. We make the same call.

const ARTICLE_PATH = /\/(?:rss\/)?articles\/([^/?#]+)/;
const BATCH_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const cache = new Map<string, string | null>();

export function googleNewsId(link: string): string | null {
  try {
    const u = new URL(link);
    if (!u.hostname.endsWith("news.google.com")) return null;
    return u.pathname.match(ARTICLE_PATH)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function signatureFor(id: string) {
  const res = await fetch(`https://news.google.com/rss/articles/${id}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  return sg && ts ? { sg, ts } : null;
}

async function decodeOne(id: string): Promise<string | null> {
  const sig = await signatureFor(id);
  if (!sig) return null;
  const inner = JSON.stringify([
    "garturlreq",
    [
      [
        "X",
        "X",
        ["X", "X"],
        null,
        null,
        1,
        1,
        "US:en",
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        0,
        1,
      ],
      "X",
      "X",
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    Number(sig.ts),
    sig.sg,
  ]);
  const body =
    "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));
  const res = await fetch(BATCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": UA,
    },
    body,
  });
  if (!res.ok) return null;
  const text = await res.text();
  // Response is ")]}'\n\n<len>\n[[...]]"; the payload is a JSON string inside the first row.
  const row = text.slice(text.indexOf("[[")).split("\n")[0];
  const payload = JSON.parse(row)?.[0]?.[2];
  if (typeof payload !== "string") return null;
  const url = JSON.parse(payload)?.[1];
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
}

export async function decodeGoogleNewsLink(link: string): Promise<string | null> {
  const id = googleNewsId(link);
  if (!id) return null;
  if (cache.has(id)) return cache.get(id)!;
  let url: string | null = null;
  try {
    url = await decodeOne(id);
  } catch (e) {
    console.error("google news decode failed", e);
  }
  // Only cache successes so a transient failure is retried on the next feed refresh.
  if (url) cache.set(id, url);
  return url;
}

// AP search for the headline: the fallback when Google won't decode an id.
export function apSearchUrl(title: string) {
  return `https://apnews.com/search?q=${encodeURIComponent(title)}`;
}
