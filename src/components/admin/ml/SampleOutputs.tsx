import { SAMPLES } from "@/lib/ml/notebook-run";

export function SampleOutputs() {
  return (
    <div className="divide-y divide-border border border-border">
      {SAMPLES.map((s) => (
        <div key={s.title} className="grid gap-4 p-5 md:grid-cols-12">
          <div className="font-serif text-lg font-semibold md:col-span-3">{s.title}</div>
          {[
            ["Fine-tuned model", s.tuned],
            ["Official summary", s.reference],
          ].map(([label, text]) => (
            <div key={label} className="text-sm leading-relaxed md:col-span-4 md:last:col-span-5">
              <div className="mb-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
              </div>
              {text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
