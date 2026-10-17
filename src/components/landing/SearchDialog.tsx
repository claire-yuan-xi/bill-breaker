import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StateCombobox } from "./StateCombobox";
import { STATES } from "@/lib/states";
import { QUESTIONS, readProfile, saveProfile, type ReaderProfile } from "@/lib/reader-profile";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { usePress } from "@/lib/press";

export type SearchMode = "number" | "paste";

// Bill number format: 1-5 letters (e.g. HB, S, HR, SB), optional space/dot/dash, 1-6 digits.
const BILL_NO_RE = /^[A-Za-z]{1,5}[.\s-]?\d{1,6}$/;
const EXAMPLES = ["HR 1234", "S 47", "HB 199", "SB 8"];

type Props = {
  open: boolean;
  mode: SearchMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: SearchMode) => void;
};

export function SearchDialog({ open, mode, onOpenChange, onModeChange }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"bill" | "about">("bill");
  const [state, setState] = useState("US");
  const [billNo, setBillNo] = useState("");
  const [text, setText] = useState("");
  const [profile, setProfile] = useState<ReaderProfile>({});
  const stepRef = useRef<HTMLDivElement>(null);
  const continueRef = usePress<HTMLButtonElement>();
  const skipRef = usePress<HTMLButtonElement>();
  const explainRef = usePress<HTMLButtonElement>();

  useEffect(() => {
    if (open) {
      setStep("bill");
      setProfile(readProfile());
    }
  }, [open]);

  useEffect(() => {
    if (!stepRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      stepRef.current.children,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.04 },
    );
  }, [step, mode, open]);

  const trimmed = billNo.trim();
  const billValid = BILL_NO_RE.test(trimmed);
  const textValid = text.trim().length >= 100;
  const canContinue = mode === "number" ? billValid : textValid;

  function toAbout(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    // A state bill tells us where they live; prefill it, but they can change it.
    if (mode === "number" && state !== "US" && !profile.state) {
      const name = STATES.find(([c]) => c === state)?.[1];
      if (name) setProfile((p) => ({ ...p, state: name }));
    }
    setStep("about");
  }

  function go(withProfile: boolean) {
    saveProfile(withProfile ? profile : {});
    onOpenChange(false);
    if (mode === "number") {
      navigate({ to: "/bill", search: { state, number: trimmed, text: "" } });
    } else {
      navigate({ to: "/bill", search: { state: "US", number: "", text } });
    }
  }

  const answered = Object.values(profile).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-none border-foreground bg-background p-0 sm:max-w-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4 pr-14 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <span className={step === "bill" ? "text-foreground" : ""}>1 · the bill</span>
          <span aria-hidden="true">—</span>
          <span className={step === "about" ? "text-foreground" : ""}>2 · about you</span>
        </div>

        {step === "bill" ? (
          <form onSubmit={toAbout} className="px-6 pb-6 pt-6 md:px-8">
            <div ref={stepRef} className="space-y-6">
              <div>
                <DialogTitle className="font-serif text-4xl font-bold tracking-tight">
                  Which bill?
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Enter a bill number or paste its text.
                </DialogDescription>
              </div>

              <div
                role="tablist"
                aria-label="How to find the bill"
                className="inline-flex border border-border"
              >
                {(
                  [
                    ["number", "By number"],
                    ["paste", "Paste text"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={mode === k}
                    onClick={() => onModeChange(k)}
                    className={
                      "px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] transition-[color,background-color,transform] duration-150 active:scale-90 " +
                      (mode === k
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "number" ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Jurisdiction
                    </div>
                    <div className="mt-3">
                      <StateCombobox value={state} onChange={setState} />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="dlg-bill-no"
                      className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                    >
                      Bill number
                    </label>
                    <input
                      id="dlg-bill-no"
                      autoFocus
                      value={billNo}
                      onChange={(e) => setBillNo(e.target.value)}
                      placeholder="HR 1234"
                      autoComplete="off"
                      aria-invalid={trimmed.length > 0 && !billValid}
                      aria-describedby="dlg-bill-hint"
                      className={
                        "mt-3 w-full border bg-background px-4 py-4 text-base outline-none transition-colors placeholder:text-muted-foreground " +
                        (trimmed && !billValid
                          ? "border-destructive"
                          : "border-border hover:border-foreground focus:border-foreground")
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <p
                      id="dlg-bill-hint"
                      className={
                        "text-[11px] " +
                        (trimmed && !billValid ? "text-destructive" : "text-muted-foreground")
                      }
                    >
                      {trimmed && !billValid
                        ? "Try a prefix and number, like HR 1234."
                        : "Prefix and number, like HR 1234."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setBillNo(ex)}
                          className="border border-border px-3 py-1.5 text-xs transition-transform duration-150 hover:border-foreground active:scale-90"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-border">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    <label htmlFor="dlg-paste">bill text</label>
                    <span>{text.length.toLocaleString()} / 50,000</span>
                  </div>
                  <textarea
                    id="dlg-paste"
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 50000))}
                    placeholder="Paste the full bill text from Congress.gov or your state legislature…"
                    className="h-56 w-full resize-none bg-transparent p-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                  />
                </div>
              )}

              <button
                ref={continueRef}
                type="submit"
                disabled={!canContinue}
                className="relative flex w-full items-center justify-between overflow-hidden bg-foreground px-6 py-5 text-background transition-opacity disabled:opacity-35"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">Next</span>
                <span data-press-arrow aria-hidden="true" className="font-bold">
                  →
                </span>
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 pb-6 pt-6 md:px-8">
            <div ref={stepRef} className="space-y-6">
              <div>
                <DialogTitle className="font-serif text-4xl font-bold tracking-tight">
                  About you
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm">
                  All optional. Stays in this tab.
                </DialogDescription>
              </div>

              <div className="space-y-5">
                {QUESTIONS.map((q) => {
                  const value = profile[q.key] ?? "";
                  const set = (v: string) => setProfile((p) => ({ ...p, [q.key]: v }));
                  const id = `about-${q.key}`;
                  return (
                    <fieldset key={q.key} className="border-t border-border pt-4">
                      <legend className="sr-only">{q.label}</legend>
                      <label
                        htmlFor={q.choices && !q.free ? undefined : id}
                        className="block text-sm"
                      >
                        {q.label}
                      </label>
                      {q.key === "state" ? (
                        <select
                          id={id}
                          value={value}
                          onChange={(e) => set(e.target.value)}
                          className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm hover:border-foreground focus:border-foreground focus:outline-none"
                        >
                          <option value="">Prefer not to say</option>
                          {STATES.filter(([c]) => c !== "US").map(([c, n]) => (
                            <option key={c} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {q.choices ? (
                        <div
                          className="mt-2 flex flex-wrap gap-2"
                          role="group"
                          aria-label={q.label}
                        >
                          {q.choices.map((c) => {
                            const on = value === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                aria-pressed={on}
                                onClick={() => set(on ? "" : c)}
                                className={
                                  "border px-3 py-2 text-xs font-medium transition-[color,background-color,transform] duration-150 active:scale-90 " +
                                  (on
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border hover:border-foreground")
                                }
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {q.free ? (
                        <input
                          id={id}
                          value={q.choices?.includes(value) ? "" : value}
                          onChange={(e) => set(e.target.value)}
                          placeholder={q.hint ?? (q.choices ? "Other" : "")}
                          className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground hover:border-foreground focus:border-foreground"
                        />
                      ) : null}
                    </fieldset>
                  );
                })}
              </div>

              <div className="sticky bottom-0 -mx-6 flex flex-col gap-3 border-t border-border bg-background px-6 pt-4 sm:flex-row md:-mx-8 md:px-8">
                <button
                  type="button"
                  onClick={() => setStep("bill")}
                  className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground transition-transform hover:text-foreground active:scale-90"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  ref={skipRef}
                  onClick={() => go(false)}
                  className="relative overflow-hidden border border-border px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] hover:border-foreground sm:ml-auto"
                >
                  Skip
                </button>
                <button
                  type="button"
                  ref={explainRef}
                  onClick={() => go(true)}
                  className="relative flex items-center justify-between gap-6 overflow-hidden bg-foreground px-6 py-4 text-background"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
                    Explain
                  </span>
                  <span data-press-arrow aria-hidden="true" className="font-bold">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
