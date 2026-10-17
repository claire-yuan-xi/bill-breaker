import type { ReaderProfile } from "@/lib/reader-profile";

/**
 * Answer word -> extra terms to look for in the bill text.
 * Ported from the Colab notebook (section 8) so the site ranks sections the same way.
 */
export const EXPANSIONS: Record<string, string[]> = {
  student: ["student", "college", "university", "tuition", "loan", "education", "school"],
  retired: ["retire", "Social Security", "pension", "Medicare"],
  "65+": ["Medicare", "Social Security", "elderly", "older", "senior"],
  "45-64": ["retire", "pension"],
  "18-24": ["student", "young", "youth"],
  "under 18": ["minor", "child", "youth", "school"],
  kids: ["child", "children", "family", "school", "parent"],
  elderly: ["elderly", "older", "senior", "caregiver", "Medicare"],
  medicare: ["Medicare"],
  medicaid: ["Medicaid", "low-income"],
  marketplace: ["health insurance", "exchange", "premium"],
  employer: ["employer", "group health plan"],
  va: ["veteran", "Department of Veterans Affairs"],
  veteran: ["veteran", "armed forces", "military", "Department of Veterans Affairs"],
  "under $30k": ["low-income", "poverty", "assistance", "credit"],
  "$30-75k": ["tax", "credit", "middle-income"],
  farm: ["agriculture", "farm", "crop", "rural"],
  teacher: ["teacher", "school", "education"],
  nurse: ["nurse", "hospital", "health care"],
  environment: ["environment", "conservation", "wildlife", "pollution", "climate", "wilderness"],
  taxes: ["tax", "Internal Revenue Code", "credit", "deduction"],
  "public lands": ["public land", "national forest", "wilderness", "Bureau of Land Management"],
};

const MILITARY_TERMS = ["veteran", "armed forces", "military", "service member"];
const STOPWORDS = new Set("just part time with work about most like public".split(" "));
const SKIPPED = new Set(["no", "none", "skip", "n/a"]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Drops blank and "no"/"none"/"skip" answers, like the notebook does before ranking. */
export function cleanProfile(profile: ReaderProfile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(profile)) {
    const v = (value ?? "").trim();
    if (v && !SKIPPED.has(v.toLowerCase())) out[key] = v;
  }
  return out;
}

/** The lower-cased words and phrases to look for in a bill for this reader, sorted. */
export function profileTerms(profile: ReaderProfile): string[] {
  const terms = new Set<string>();
  for (const [key, answer] of Object.entries(cleanProfile(profile))) {
    // The site's chips use en dashes ("18–24"); the notebook's triggers use hyphens.
    const low = answer.toLowerCase().replace(/[\u2013\u2014]/g, "-");
    if (key === "work" || key === "interests") {
      for (const w of low.match(/[a-z][a-z-]{3,}/g) ?? []) if (!STOPWORDS.has(w)) terms.add(w);
    }
    if (key === "military" && low.startsWith("y")) MILITARY_TERMS.forEach((t) => terms.add(t));
    for (const [trigger, extra] of Object.entries(EXPANSIONS)) {
      if (new RegExp(`(?<![a-z])${escape(trigger)}(?![a-z])`).test(low)) {
        extra.forEach((e) => terms.add(e.toLowerCase()));
      }
    }
  }
  const state = cleanProfile(profile).state;
  if (state) terms.add(state.toLowerCase());
  return [...terms].sort();
}
