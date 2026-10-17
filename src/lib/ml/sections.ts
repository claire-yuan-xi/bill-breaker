import type { ReaderProfile } from "@/lib/reader-profile";
import { profileTerms } from "./profile-terms";

export type BillSection = { section: string; heading: string; body: string };
export type RankedSection = BillSection & {
  score: number;
  matchedTerms: string[];
  hits: Record<string, number>;
};

// Matches "SEC. 5. TITLE", "Section 2203 ...", "§ 12 ..." at the start of a line (notebook section 8).
const SECTION_HEADING =
  /^\s*(?:SEC(?:TION)?\.?\s+|§\s*)(?<no>\d+[A-Z0-9]*(?:[-–]\d+[A-Z0-9]*)?)\.?\s*(?<title>[^\n]{0,200})\s*$/gim;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Splits a bill at its SEC. headings; falls back to ~850-word paragraph chunks. */
export function splitBillSections(billText: string, maxChunkWords = 850): BillSection[] {
  const text = (billText ?? "").replace(/\r\n?/g, "\n").trim();
  const matches = [...text.matchAll(SECTION_HEADING)];
  if (matches.length) {
    return matches.map((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      return {
        section: m.groups?.no ?? String(i + 1),
        heading: (m.groups?.title ?? "").trim().replace(/^[\s.\-:]+|[\s.\-:]+$/g, ""),
        body: text.slice(start, end).trim(),
      };
    });
  }
  const sections: BillSection[] = [];
  let carry: string[] = [];
  let total = 0;
  const flush = () => {
    sections.push({
      section: String(sections.length + 1),
      heading: "Unnumbered text chunk",
      body: carry.join("\n\n"),
    });
    carry = [];
    total = 0;
  };
  for (const p of text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    if (carry.length && total + words(p) > maxChunkWords) flush();
    carry.push(p);
    total += words(p);
  }
  if (carry.length) flush();
  return sections;
}

/** Scores every section by how often the reader's terms appear in it; returns the top matches. */
export function rankSections(
  billText: string,
  profile: ReaderProfile,
  topK = 3,
): { terms: string[]; ranked: RankedSection[]; total: number } {
  const terms = profileTerms(profile);
  const all = splitBillSections(billText);
  const rows = all.map((s) => {
    const body = `${s.heading} ${s.body}`.toLowerCase();
    const hits: Record<string, number> = {};
    for (const t of terms) {
      const n = body.match(new RegExp(`\\b${escape(t)}`, "g"))?.length ?? 0;
      if (n) hits[t] = n;
    }
    const matchedTerms = Object.keys(hits).sort();
    const score = Object.values(hits).reduce((a, b) => a + b, 0);
    return { ...s, score, matchedTerms, hits };
  });
  const ranked = rows
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return { terms, ranked, total: all.length };
}
