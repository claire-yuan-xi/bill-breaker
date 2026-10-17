/**
 * A cheap grounding check for the personalized explanation: every sentence should be
 * backed by the bill summary and the sections it was given. It flags sentences that
 * introduce topics, numbers or judgments the sources never mention. A heuristic, not
 * proof; it is there to surface lines like an invented "higher healthcare costs".
 */

export type ClaimFlag = "new-topic" | "new-number" | "opinion" | "weak-support";
export type CheckedClaim = {
  text: string;
  support: number; // share of the sentence's content words found in the sources, 0..1
  unsupported: string[]; // content words not found in the sources
  flags: ClaimFlag[];
};
export type ClaimsReport = { claims: CheckedClaim[]; flagged: number };

const STOP = new Set(
  (
    "about above after again also although among another any are around because been before being " +
    "between both but can could does doing down during each either even ever every from further have " +
    "having here into it's its just least less like likely little made make many might more most much " +
    "must near need never other over own perhaps quite rather really same should since some still such " +
    "than that their them then there these they this those though through under until upon very want " +
    "were what when where whether which while will with within without would your you're you'll yours " +
    "bill bills act law means could mean affect affected affects directly indirectly overall summary " +
    "what this does it the and for not was has had our out who how why all one two way " +
    "you your we us here's know help helps aims life new time line way ways well also"
  ).split(" "),
);

// Phrases a neutral, source-bound explanation should not contain.
const OPINION =
  /\b(benefits? outweigh|is (a )?good|is (a )?bad|you should (vote|support|oppose)|we can better|important to support|great news|unfortunately)\b/i;

// Topics where an invented effect would mislead a reader; one missing from the sources is a red flag.
const RISKY =
  /^(health|healthcare|medical|illness|illnesses|disease|cost|costs|price|prices|premium|premiums|insurance|tax|taxes|fee|fees|fine|fines|penalty|penalties|expense|expenses|wage|wages|salary|income|loan|loans|tuition|debt|benefit|benefits|funding|money|dollar|dollars|crime|immigration|deport|lawsuit|liability)$/;

const stem = (w: string) => w.replace(/(ies|es|s|ing|ed|ly)$/i, "");

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter((w) => !STOP.has(w));
}

export function splitSentences(text: string): string[] {
  return (
    text
      .replace(/\*\*|__|^#+\s*/gm, "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
      // Skip headings and lead-ins such as "What it could mean for you" or "Here's what to know:".
      .filter((s) => s.split(/\s+/).length >= 5 && !/:$/.test(s) && /[.!?)]$/.test(s))
  );
}

/**
 * `readerWords` are the reader's own answers: a sentence may restate them
 * ("as a college student") without that counting against it.
 */
export function checkClaims(
  explanation: string,
  sources: string[],
  readerWords = "",
): ClaimsReport {
  const known = new Set(
    [...contentWords(sources.join(" ")), ...contentWords(readerWords)].map(stem),
  );
  const sourceNumbers = new Set(sources.join(" ").match(/\d[\d,.]*/g) ?? []);
  const claims = splitSentences(explanation).map((text) => {
    const cw = contentWords(text);
    const unsupported = [...new Set(cw.filter((w) => !known.has(stem(w))))];
    const support = cw.length ? 1 - unsupported.length / new Set(cw).size : 1;
    const flags: ClaimFlag[] = [];
    if (unsupported.some((w) => RISKY.test(w))) flags.push("new-topic");
    else if (unsupported.length >= 5 && support < 0.3) flags.push("weak-support");
    const numbers = text.match(/\d[\d,.]*/g) ?? [];
    if (numbers.some((n) => n.length > 1 && !sourceNumbers.has(n))) flags.push("new-number");
    if (OPINION.test(text)) flags.push("opinion");
    return { text, support: Math.max(0, support), unsupported, flags };
  });
  return { claims, flagged: claims.filter((c) => c.flags.length).length };
}
