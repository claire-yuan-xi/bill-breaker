import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion";
import { usePress } from "@/lib/press";

/** Keeps the explainer one tap away once the hero button has scrolled off screen. */
export function FloatingExplain({ after, onClick }: { after: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const press = usePress<HTMLButtonElement>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.set(el, { autoAlpha: 0, y: 24 });
    const show = (on: boolean) =>
      gsap.to(el, {
        autoAlpha: on ? 1 : 0,
        y: on ? 0 : 24,
        duration: 0.45,
        ease: "power3.out",
        overwrite: "auto",
      });
    const st = ScrollTrigger.create({
      trigger: after,
      start: "bottom 30%",
      onEnter: () => show(true),
      onLeaveBack: () => show(false),
    });
    return () => st.kill();
  }, [after]);

  return (
    <button
      ref={(el) => {
        ref.current = el;
        press(el);
      }}
      type="button"
      onClick={onClick}
      className="invisible fixed bottom-5 overflow-hidden left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full bg-foreground py-3 pl-6 pr-3 text-background shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:left-auto md:right-6 md:translate-x-0"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.25em]">Explain a bill</span>
      <span
        data-press-arrow
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-foreground"
      >
        →
      </span>
    </button>
  );
}
