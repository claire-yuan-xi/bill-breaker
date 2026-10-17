import type { ClaimFlag, ClaimsReport } from "@/lib/ml/claims-check";

const FLAG_LABEL: Record<ClaimFlag, string> = {
  "new-topic": "Effect not in the bill",
  "new-number": "Number not in the bill",
  opinion: "Opinion",
  "weak-support": "Loosely supported",
};
const SERIOUS: ClaimFlag[] = ["new-topic", "new-number", "opinion"];

/** Every sentence of the personalized explanation, marked by how well the sources back it. */
export function ClaimsView({ report }: { report: ClaimsReport }) {
  const serious = report.claims.filter((c) => c.flags.some((f) => SERIOUS.includes(f))).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span className="font-serif text-2xl font-bold">
          {serious} of {report.claims.length}
        </span>
        <span className="text-muted-foreground">
          sentences need review before a reader sees them
        </span>
      </div>
      <ol className="space-y-2">
        {report.claims.map((c, i) => {
          const bad = c.flags.some((f) => SERIOUS.includes(f));
          const soft = !bad && c.flags.length > 0;
          return (
            <li
              key={i}
              className={
                "border-l-4 py-2 pl-4 text-sm leading-relaxed " +
                (bad
                  ? "border-[#c0392b] bg-[#c0392b]/5"
                  : soft
                    ? "border-[#b7791f] bg-[#b7791f]/5"
                    : "border-border")
              }
            >
              <p>{c.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {Math.round(c.support * 100)}% of words in sources
                </span>
                {c.flags.map((f) => (
                  <span
                    key={f}
                    className={
                      "border px-1.5 py-0.5 uppercase tracking-[0.15em] " +
                      (SERIOUS.includes(f)
                        ? "border-[#c0392b] text-[#c0392b]"
                        : "border-[#b7791f] text-[#8a5a12]")
                    }
                  >
                    {FLAG_LABEL[f]}
                  </span>
                ))}
                {c.flags.length && c.unsupported.length ? (
                  <span>not in sources: {c.unsupported.slice(0, 6).join(", ")}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
