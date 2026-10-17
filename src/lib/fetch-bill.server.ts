// Best-effort bill-text fetcher with a multi-source fallback chain.
// Each tier has its own timeout; the function gives up after the total budget.

import { fetchGovInfoBillText } from "@/lib/sources/govinfo.server";
import { fetchOpenStatesBillText } from "@/lib/sources/openstates.server";

const UA = "Mozilla/5.0 (compatible; BillBreaker/1.0)";

const CHAMBER_MAP: Record<string, string> = {
  HR: "house-bill",
  H: "house-bill",
  HRES: "house-resolution",
  HJRES: "house-joint-resolution",
  HCONRES: "house-concurrent-resolution",
  S: "senate-bill",
  SRES: "senate-resolution",
  SJRES: "senate-joint-resolution",
  SCONRES: "senate-concurrent-resolution",
};

function parseBillNo(billNo: string): { chamber: string; num: string } | null {
  const m = /^([A-Za-z]+)[.\s-]?(\d{1,6})$/.exec(billNo.trim());
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const chamber = CHAMBER_MAP[prefix];
  if (!chamber) return null;
  return { chamber, num: m[2] };
}

function currentCongress(): number {
  const y = new Date().getFullYear();
  return Math.floor((y - 1789) / 2) + 1;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function stripHtml(html: string): string {
  return html
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
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type FetchedBill = { text: string; sourceUrl: string } | null;
export type BillSource = "congress.gov" | "govinfo" | "openstates";

export type FetchedBillWithSource = {
  text: string;
  sourceUrl: string;
  source: BillSource;
  tried: BillSource[];
};

/**
 * Backwards-compatible Congress.gov-only fetcher.
 * Prefer `fetchBillTextFromSources` for new code.
 */
export async function fetchUSBillText(billNo: string, timeoutMs = 6000): Promise<FetchedBill> {
  const parsed = parseBillNo(billNo);
  if (!parsed) return null;
  const congress = currentCongress();
  for (const c of [congress, congress - 1]) {
    const url = `https://www.congress.gov/bill/${ordinal(c)}-congress/${parsed.chamber}/${parsed.num}/text?format=txt`;
    const res = await fetchWithTimeout(url, timeoutMs);
    if (!res || !res.ok) continue;
    const html = await res.text();
    const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
    const raw = preMatch ? preMatch[1] : html;
    const text = stripHtml(raw);
    if (text.length > 400) return { text, sourceUrl: url.replace("?format=txt", "") };
  }
  return null;
}

/**
 * Multi-source bill text fetcher. Returns the first source that yields >400
 * chars of text, plus a list of every source attempted (for diagnostics).
 *
 * - state === "US": Congress.gov → GovInfo
 * - state !== "US": OpenStates (skipped silently if OPENSTATES_API_KEY unset)
 */
export async function fetchBillTextFromSources(args: {
  state: string;
  billNo: string;
  totalBudgetMs?: number;
  perTierTimeoutMs?: number;
}): Promise<FetchedBillWithSource | { text: null; tried: BillSource[] }> {
  const tried: BillSource[] = [];
  const start = Date.now();
  const budget = args.totalBudgetMs ?? 15_000;
  const tierTimeout = args.perTierTimeoutMs ?? 6_000;
  const remaining = () => Math.max(0, budget - (Date.now() - start));

  if (args.state === "US") {
    tried.push("congress.gov");
    if (remaining() > 0) {
      const r = await fetchUSBillText(args.billNo, Math.min(tierTimeout, remaining()));
      if (r) return { ...r, source: "congress.gov", tried };
    }
    tried.push("govinfo");
    if (remaining() > 0) {
      const r = await fetchGovInfoBillText(args.billNo, Math.min(tierTimeout, remaining()));
      if (r) return { ...r, source: "govinfo", tried };
    }
  } else {
    tried.push("openstates");
    if (remaining() > 0) {
      const r = await fetchOpenStatesBillText(
        args.state,
        args.billNo,
        Math.min(tierTimeout, remaining()),
      );
      if (r) return { ...r, source: "openstates", tried };
    }
  }
  return { text: null, tried };
}
