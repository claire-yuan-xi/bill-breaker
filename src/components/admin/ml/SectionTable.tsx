type Row = { section: string; heading: string; score: number; matchedTerms: string[] };

/** Ranked bill sections with a score bar, as passed to the personalizer. */
export function SectionTable({ rows, total }: { rows: Row[]; total?: number }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No section mentions this reader's terms, so the explanation should say the bill does not
        clearly affect them.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.score));
  return (
    <div>
      <table className="w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-normal">Sec.</th>
            <th className="py-2 pr-4 font-normal">Heading</th>
            <th className="w-40 py-2 pr-4 font-normal">Score</th>
            <th className="py-2 font-normal">Matched terms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.section}-${r.heading}`} className="border-b border-border align-top">
              <td className="py-3 pr-4 tabular-nums">{r.section}</td>
              <td className="py-3 pr-4">{r.heading || "(untitled)"}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2" title={`Score ${r.score}`}>
                  <div className="h-2 flex-1">
                    <div
                      className="h-full rounded-r-[4px] bg-[#d9661a]"
                      style={{ width: `${(r.score / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums">{r.score}</span>
                </div>
              </td>
              <td className="py-3 text-xs text-muted-foreground">{r.matchedTerms.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Top {rows.length} of {total} sections.
        </p>
      ) : null}
    </div>
  );
}
