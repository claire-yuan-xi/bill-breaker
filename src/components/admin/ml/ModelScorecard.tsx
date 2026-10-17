import { MODEL_CARD, ROUGE, type RougeRow } from "@/lib/ml/notebook-run";

const METRICS: { key: keyof Omit<RougeRow, "name">; label: string }[] = [
  { key: "rouge1", label: "ROUGE-1" },
  { key: "rouge2", label: "ROUGE-2" },
  { key: "rougeL", label: "ROUGE-L" },
  { key: "rougeLsum", label: "ROUGE-Lsum" },
];
// Validated pair (light surface): baseline blue, fine-tuned orange.
const COLORS = ["#4f7cc4", "#d9661a"];
const MAX = 0.5;

export function ModelScorecard() {
  const [base, tuned] = ROUGE;
  const lift = Math.round((tuned.rouge1 / base.rouge1 - 1) * 100);
  return (
    <div className="grid gap-10 md:grid-cols-12">
      <div className="md:col-span-4">
        <div className="font-serif text-6xl font-bold tracking-tight">+{lift}%</div>
        <p className="mt-2 text-sm text-muted-foreground">
          ROUGE-1 over untrained FLAN-T5, on {MODEL_CARD.evalSet}.
        </p>
        <dl className="mt-6 space-y-3 text-xs">
          {[
            ["Base model", `${MODEL_CARD.base} (${MODEL_CARD.params})`],
            ["Trained on", MODEL_CARD.trainedOn],
            ["Personalizer", MODEL_CARD.personalizer],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{k}</dt>
              <dd className="mt-1">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <figure className="md:col-span-8" aria-label="ROUGE scores, untrained versus fine-tuned">
        <div className="mb-4 flex flex-wrap gap-5 text-xs">
          {ROUGE.map((r, i) => (
            <span key={r.name} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: COLORS[i] }}
              />
              {r.name}
            </span>
          ))}
        </div>
        <div className="space-y-5">
          {METRICS.map((m) => (
            <div key={m.key}>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {m.label}
              </div>
              <div className="mt-2 space-y-[2px]">
                {ROUGE.map((r, i) => (
                  <div
                    key={r.name}
                    className="group flex items-center gap-3"
                    title={`${r.name} · ${m.label}: ${r[m.key].toFixed(3)}`}
                  >
                    <div className="h-4 flex-1">
                      <div
                        className="h-full rounded-r-[4px] transition-opacity group-hover:opacity-80"
                        style={{ width: `${(r[m.key] / MAX) * 100}%`, background: COLORS[i] }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums">
                      {r[m.key].toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <figcaption className="mt-4 text-[11px] text-muted-foreground">
          Word overlap with the official summaries; higher is better. Scale 0 to 0.5.
        </figcaption>
      </figure>
    </div>
  );
}
