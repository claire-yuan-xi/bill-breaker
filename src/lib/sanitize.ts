// Neutralize prompt-injection markers so the model treats the body as data,
// not instructions. Pure function — kept here for unit-testing without pulling
// in TanStack server-route module side effects.
export function sanitizeBillText(input: string): string {
  return input
    .replace(/```/g, "ʼʼʼ")
    .replace(/<\/?bill_text>/gi, "")
    .replace(/^[ \t]*(system|assistant|user)\s*:/gim, "$1 :")
    .replace(/^[ \t]*###+/gm, "")
    .slice(0, 80000);
}
