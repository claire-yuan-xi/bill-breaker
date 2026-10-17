// GovInfo bulk-data fallback for US federal bills. No API key required for
// bulk-data document endpoints. Returns null on any failure.

const UA = "Mozilla/5.0 (compatible; BillBreaker/1.0)";

const CHAMBER_TYPE_MAP: Record<string, string> = {
  HR: "hr",
  H: "hr",
  HRES: "hres",
  HJRES: "hjres",
  HCONRES: "hconres",
  S: "s",
  SRES: "sres",
  SJRES: "sjres",
  SCONRES: "sconres",
};

function parseBillNo(billNo: string): { type: string; num: string } | null {
  const m = /^([A-Za-z]+)[.\s-]?(\d{1,6})$/.exec(billNo.trim());
  if (!m) return null;
  const type = CHAMBER_TYPE_MAP[m[1].toUpperCase()];
  return type ? { type, num: m[2] } : null;
}

function currentCongress(): number {
  const y = new Date().getFullYear();
  return Math.floor((y - 1789) / 2) + 1;
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(p|br|div|li|h\d|tr|td)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xml" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchGovInfoBillText(
  billNo: string,
  timeoutMs = 6000,
): Promise<{ text: string; sourceUrl: string } | null> {
  const parsed = parseBillNo(billNo);
  if (!parsed) return null;
  const versions = ["ih", "is", "rh", "rs", "enr"]; // introduced/reported/enrolled.
  const congress = currentCongress();

  for (const c of [congress, congress - 1]) {
    for (const v of versions) {
      const id = `BILLS-${c}${parsed.type}${parsed.num}${v}`;
      const url = `https://www.govinfo.gov/content/pkg/${id}/html/${id}.htm`;
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res || !res.ok) continue;
      const html = await res.text();
      const text = stripHtml(html);
      if (text.length > 400) {
        return { text, sourceUrl: `https://www.govinfo.gov/app/details/${id}` };
      }
    }
  }
  return null;
}
