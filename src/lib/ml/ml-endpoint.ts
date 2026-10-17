import type { ReaderProfile } from "@/lib/reader-profile";

/**
 * Where the hosted model will live (for example a Hugging Face Space or Inference
 * Endpoint serving the fine-tuned FLAN-T5 and the personalizer). Unset until the
 * weights are saved and deployed; the admin view then shows the notebook run instead.
 */
export const ML_ENDPOINT: string | undefined = import.meta.env.VITE_ML_ENDPOINT || undefined;

export type ExplainResponse = { general: string; personalized: string };

export async function explainWithModel(
  text: string,
  title: string,
  profile: ReaderProfile,
): Promise<ExplainResponse> {
  if (!ML_ENDPOINT) throw new Error("No model endpoint configured (VITE_ML_ENDPOINT).");
  const res = await fetch(ML_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, title, profile }),
  });
  if (!res.ok) throw new Error(`Model endpoint returned ${res.status}`);
  return (await res.json()) as ExplainResponse;
}
