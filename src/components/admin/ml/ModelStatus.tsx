import { ML_ENDPOINT } from "@/lib/ml/ml-endpoint";
import { MODEL_CARD } from "@/lib/ml/notebook-run";

/** What is live versus still on the notebook, and the next step to change that. */
export function ModelStatus() {
  const rows: [string, boolean, string][] = [
    ["Section ranking", true, "Runs in the browser; same rules as the notebook."],
    ["Claims check", true, "Runs in the browser on any explanation."],
    [
      "Fine-tuned weights saved",
      MODEL_CARD.weightsSaved,
      "Set SAVE_TO_DRIVE = True (or push to the Hugging Face Hub) and re-run training.",
    ],
    [
      "Model endpoint",
      Boolean(ML_ENDPOINT),
      ML_ENDPOINT ? ML_ENDPOINT : "Host the model, then set VITE_ML_ENDPOINT.",
    ],
  ];
  return (
    <ul className="grid gap-px border border-border bg-border sm:grid-cols-2">
      {rows.map(([label, ok, note]) => (
        <li key={label} className="bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden="true"
              className={
                "inline-block h-2 w-2 rounded-full " + (ok ? "bg-[#2f855a]" : "bg-[#b7791f]")
              }
            />
            {label}
            <span className="ml-auto text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {ok ? "Ready" : "To do"}
            </span>
          </div>
          <p className="mt-1 break-words text-xs text-muted-foreground">{note}</p>
        </li>
      ))}
    </ul>
  );
}
