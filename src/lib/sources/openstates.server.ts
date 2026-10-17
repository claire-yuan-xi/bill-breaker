// OpenStates v3 fallback for US state legislation. Requires OPENSTATES_API_KEY.
// Silently skipped (returns null) when the key isn't configured.

const UA = "Mozilla/5.0 (compatible; BillBreaker/1.0)";

function parseBillNo(billNo: string): { prefix: string; num: string } | null {
  const m = /^([A-Za-z]+)[.\s-]?(\d{1,6})$/.exec(billNo.trim());
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), num: m[2] };
}

async function fetchWithTimeout(url: string, ms: number, headers: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchOpenStatesBillText(
  state: string,
  billNo: string,
  timeoutMs = 6000,
): Promise<{ text: string; sourceUrl: string } | null> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) return null;
  const parsed = parseBillNo(billNo);
  if (!parsed) return null;

  const jurisdiction = `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`;
  const identifier = `${parsed.prefix} ${parsed.num}`;
  const searchUrl =
    `https://v3.openstates.org/bills?jurisdiction=${encodeURIComponent(jurisdiction)}` +
    `&identifier=${encodeURIComponent(identifier)}&include=versions&per_page=1`;

  const headers = { "User-Agent": UA, "X-API-KEY": key, Accept: "application/json" };
  const search = await fetchWithTimeout(searchUrl, timeoutMs, headers);
  if (!search || !search.ok) return null;
  let body: unknown;
  try {
    body = await search.json();
  } catch {
    return null;
  }

  const result = (body as { results?: Array<Record<string, unknown>> }).results?.[0];
  if (!result) return null;

  const versions =
    (result.versions as Array<{ links?: Array<{ url?: string; media_type?: string }> }>) ?? [];
  const link = versions
    .flatMap((v) => v.links ?? [])
    .find((l) => l.url && /text|html|plain/i.test(l.media_type ?? "text/html"));
  const sourceUrl =
    link?.url || ((result.sources as Array<{ url?: string }> | undefined)?.[0]?.url ?? "");
  if (!sourceUrl) return null;

  // SSRF guard: only fetch https URLs on public legislative/news hosts.
  // OpenStates is third-party; a compromised response could otherwise point
  // us at cloud metadata or internal services.
  let target: URL;
  try {
    target = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "https:") return null;
  const host = target.hostname.toLowerCase();
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|fc00:|fd00:)/i.test(host)) return null;
  const ALLOWED_SUFFIXES = [".gov", ".us", "legiscan.com", "openstates.org"];
  const allowed = ALLOWED_SUFFIXES.some((s) => host === s.replace(/^\./, "") || host.endsWith(s));
  if (!allowed) return null;

  const text = await fetchWithTimeout(target.toString(), timeoutMs, {
    "User-Agent": UA,
    Accept: "text/html,text/plain",
  });
  if (!text || !text.ok) return null;
  const raw = await text.text();
  const cleaned = stripHtml(raw);
  if (cleaned.length < 400) return null;
  return { text: cleaned, sourceUrl };
}
