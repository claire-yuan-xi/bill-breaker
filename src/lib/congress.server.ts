// Server-only helpers that read congress.gov public surfaces.
// No API key required — uses RSS feeds for trending and the public bill
// page HTML for status. Fail-soft: every helper returns null/[] on error.

const UA = "Mozilla/5.0 (compatible; BillBreaker/1.0)";

export type TrendingBill = {
  state: "US";
  bill_no: string; // e.g. "HR 1234"
  title: string;
  url: string;
};

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string) {
  return decodeEntities(
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

// e.g. "S 1234 - 118th Congress (2023-2024)" → "S 1234"
function billNoFromTitle(t: string): string | null {
  const m = t.match(/^([A-Z]{1,7})\.?\s*(\d{1,6})/);
  if (!m) return null;
  return `${m[1]} ${m[2]}`.toUpperCase();
}

export async function fetchTrendingBills(): Promise<TrendingBill[]> {
  try {
    const res = await fetch("https://www.congress.gov/rss/most-viewed-bills.xml", {
      headers: { "User-Agent": UA, Accept: "application/rss+xml,text/xml" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1);
    const out: TrendingBill[] = [];
    for (const raw of items) {
      const block = "<item>" + raw.split("</item>")[0] + "</item>";
      const titleRaw = extractTag(block, "title");
      const link = extractTag(block, "link");
      const desc = stripTags(extractTag(block, "description"));
      if (!titleRaw || !link) continue;
      const billNo = billNoFromTitle(titleRaw);
      if (!billNo) continue;
      // Use the description if it's substantive, else the title.
      const cleanTitle =
        desc && desc.length > 12 && desc.length < 240 ? desc : titleRaw.split(" - ")[0];
      out.push({ state: "US", bill_no: billNo, title: cleanTitle, url: link });
      if (out.length >= 12) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchBillsByKeyword(q: string): Promise<TrendingBill[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const url =
      `https://www.congress.gov/quick-search/legislation?wordsPhrases=${encodeURIComponent(term)}` +
      `&wordVariants=on&searchResultViewType=expanded&pageSize=20`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    // The results list each link as: <a href="/bill/119th-congress/house-bill/1234">H.R.1234 - Title</a>
    const re = /<a\s+href="(\/bill\/[^"]+)"[^>]*>([A-Z]{1,7}\.?\s*\d{1,6})\s*-\s*([^<]+)<\/a>/g;
    const seen = new Set<string>();
    const out: TrendingBill[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const path = m[1];
      const ident = m[2].replace(/\./g, "").replace(/\s+/g, " ").toUpperCase().trim();
      const title = decodeEntities(m[3]).trim();
      const key = ident;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        state: "US",
        bill_no: ident,
        title,
        url: `https://www.congress.gov${path}`,
      });
      if (out.length >= 15) break;
    }
    return out;
  } catch {
    return [];
  }
}

export type BillStatus = {
  status: string | null; // e.g. "Passed House"
  lastAction: string | null; // e.g. "Referred to the Subcommittee on..."
  lastActionDate: string | null; // ISO date if parseable
};

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

function currentCongress(): number {
  const y = new Date().getFullYear();
  return Math.floor((y - 1789) / 2) + 1;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function fetchUSBillStatus(billNo: string): Promise<BillStatus | null> {
  const m = /^([A-Za-z]+)[.\s-]?(\d{1,6})$/.exec(billNo.trim());
  if (!m) return null;
  const chamber = CHAMBER_MAP[m[1].toUpperCase()];
  if (!chamber) return null;
  const num = m[2];

  for (const c of [currentCongress(), currentCongress() - 1]) {
    const url = `https://www.congress.gov/bill/${ordinal(c)}-congress/${chamber}/${num}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (!res.ok) continue;
      const html = await res.text();
      // Status banner: <h2 class="hide_fromMobile_show_onDesktop ...">Became Public Law No: 118-12</h2>
      // Or "Latest Action" row in the bill summary table.
      const statusMatch =
        html.match(/<h2[^>]*class="[^"]*overview_tracker[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) ||
        html.match(/<span[^>]*class="[^"]*sol-step[^"]*selected[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
        html.match(/Latest Action:<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const lastActionMatch = html.match(/Latest Action[^<]*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const status = statusMatch ? stripTags(statusMatch[1]).slice(0, 160) : null;
      const lastActionRaw = lastActionMatch ? stripTags(lastActionMatch[1]) : null;
      let lastAction: string | null = null;
      let lastActionDate: string | null = null;
      if (lastActionRaw) {
        // Format is usually "MM/DD/YYYY-Chamber. Description"
        const dm = lastActionRaw.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dm) {
          const [mm, dd, yyyy] = dm[1].split("/");
          const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z`);
          if (!isNaN(d.getTime())) lastActionDate = d.toISOString();
          lastAction = lastActionRaw
            .slice(dm[1].length)
            .replace(/^[-\s]+/, "")
            .slice(0, 400);
        } else {
          lastAction = lastActionRaw.slice(0, 400);
        }
      }
      if (!status && !lastAction) continue;
      return { status, lastAction, lastActionDate };
    } catch {
      // try next congress
    }
  }
  return null;
}
