import { checkClaims } from "@/lib/ml/claims-check";
import { EXAMPLE_PROFILE, EXAMPLE_RUN } from "@/lib/ml/notebook-run";
import { profileTerms } from "@/lib/ml/profile-terms";
import { ClaimsView } from "./ClaimsView";
import { Panel } from "./Panel";
import { ReaderTerms } from "./ReaderTerms";
import { SectionTable } from "./SectionTable";

/** Steps 3 to 6: one real run from the notebook, from reader answers to a checked explanation. */
export function NotebookTrace() {
  // The notebook kept only section headings in its output, so the claims check reads
  // those plus the general summary; with full section text it would be stricter and fairer.
  const report = checkClaims(
    EXAMPLE_RUN.personalized,
    [EXAMPLE_RUN.general, ...EXAMPLE_RUN.sections.map((s) => s.heading)],
    Object.values(EXAMPLE_PROFILE).join(" "),
  );
  return (
    <>
      <Panel step="03 · Reader" title="Who it's explaining to">
        <ReaderTerms profile={EXAMPLE_PROFILE} terms={profileTerms(EXAMPLE_PROFILE)} />
      </Panel>
      <Panel step="04 · Ranking" title={`What matters in ${EXAMPLE_RUN.title}`}>
        <SectionTable rows={EXAMPLE_RUN.sections} />
      </Panel>
      <Panel step="05 · Summary" title="General summary">
        <p className="max-w-3xl text-sm leading-relaxed">{EXAMPLE_RUN.general}</p>
      </Panel>
      <Panel step="06 · Personalized + checked" title="What the reader would see">
        <ClaimsView report={report} />
      </Panel>
    </>
  );
}
