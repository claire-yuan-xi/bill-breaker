import { useMemo, useState } from "react";
import { checkClaims } from "@/lib/ml/claims-check";
import { explainWithModel, ML_ENDPOINT, type ExplainResponse } from "@/lib/ml/ml-endpoint";
import { EXAMPLE_PROFILE } from "@/lib/ml/notebook-run";
import { rankSections } from "@/lib/ml/sections";
import { readProfile, type ReaderProfile } from "@/lib/reader-profile";
import { ClaimsView } from "./ClaimsView";
import { ReaderTerms } from "./ReaderTerms";
import { SectionTable } from "./SectionTable";

type Source = "example" | "mine";

/** Paste any bill and watch the pipeline rank it for a reader; calls the model once it is hosted. */
export function Playground() {
  const [source, setSource] = useState<Source>("example");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const profile: ReaderProfile = useMemo(
    () => (source === "example" ? EXAMPLE_PROFILE : readProfile()),
    [source],
  );
  const ranking = useMemo(() => rankSections(text, profile), [text, profile]);
  const report = useMemo(() => {
    if (!result) return null;
    const sources = [result.general, ...ranking.ranked.map((s) => `${s.heading} ${s.body}`)];
    return checkClaims(result.personalized, sources, Object.values(profile).join(" "));
  }, [result, ranking, profile]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setResult(await explainWithModel(text, "Pasted bill", profile));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The model call failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Reader" className="inline-flex border border-border">
          {(
            [
              ["example", "Notebook reader"],
              ["mine", "My answers (this tab)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={source === k}
              onClick={() => setSource(k)}
              className={
                "px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] " +
                (source === k ? "bg-foreground text-background" : "text-muted-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ReaderTerms profile={profile} terms={ranking.terms} />

      <div>
        <label
          htmlFor="ml-bill-text"
          className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
        >
          Bill text
        </label>
        <textarea
          id="ml-bill-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder="Paste full bill text from Congress.gov (with its SEC. headings)…"
          className="mt-2 h-48 w-full resize-y border border-border bg-background p-4 text-sm outline-none focus:border-foreground"
        />
      </div>

      {text.trim() ? <SectionTable rows={ranking.ranked} total={ranking.total} /> : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={generate}
          disabled={!ML_ENDPOINT || !text.trim() || busy}
          className="bg-foreground px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-background disabled:opacity-35"
        >
          {busy ? "Generating…" : "Generate explanation"}
        </button>
        {!ML_ENDPOINT ? (
          <span className="text-xs text-muted-foreground">
            Turns on once the model is hosted and VITE_ML_ENDPOINT is set.
          </span>
        ) : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>

      {result && report ? (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              General summary{" "}
            </span>
            {result.general}
          </p>
          <ClaimsView report={report} />
        </div>
      ) : null}
    </div>
  );
}
