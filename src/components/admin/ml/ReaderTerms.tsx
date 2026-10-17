import { cleanProfile } from "@/lib/ml/profile-terms";
import type { ReaderProfile } from "@/lib/reader-profile";

/** The reader's answers on the left, the search terms they expand to on the right. */
export function ReaderTerms({ profile, terms }: { profile: ReaderProfile; terms: string[] }) {
  const answers = Object.entries(cleanProfile(profile));
  return (
    <div className="grid gap-8 md:grid-cols-12">
      <dl className="space-y-2 text-sm md:col-span-5">
        {answers.length ? (
          answers.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-24 shrink-0 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {k}
              </dt>
              <dd>{v}</dd>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No answers; the general summary is all they get.</p>
        )}
      </dl>
      <div className="md:col-span-7">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {terms.length} terms searched for
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {terms.map((t) => (
            <span key={t} className="border border-border px-2 py-1 text-xs">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
