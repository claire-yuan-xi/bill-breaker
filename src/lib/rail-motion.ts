import { useEffect, type DependencyList, type RefObject } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";

/**
 * Motion for the horizontal news rail, all outside React state so scrolling
 * never re-renders the cards:
 * - the progress hairline follows the scroll position with a little easing,
 * - cards lean with the rail's scroll speed and spring back when it stops,
 * - under a mouse, a card tilts toward the pointer and a soft glare follows it.
 */
export function useRailMotion(
  railRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  deps: DependencyList,
) {
  useEffect(() => {
    const rail = railRef.current;
    const bar = barRef.current;
    if (!rail) return;
    const reduced = prefersReducedMotion();
    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-news-card] > a"));

    const toBar = bar
      ? gsap.quickTo(bar, "scaleX", { duration: reduced ? 0 : 0.35, ease: "power3.out" })
      : null;
    const lean = cards.map((c) => gsap.quickTo(c, "skewX", { duration: 0.5, ease: "power3.out" }));

    let lastX = rail.scrollLeft;
    let lastT = performance.now();
    let settle: gsap.core.Tween | null = null;
    const onScroll = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      toBar?.(Math.max(0.06, max > 0 ? rail.scrollLeft / max : 0));
      if (reduced) return;
      const now = performance.now();
      const v = (rail.scrollLeft - lastX) / Math.max(1, now - lastT); // px per ms
      lastX = rail.scrollLeft;
      lastT = now;
      const skew = gsap.utils.clamp(-6, 6, -v * 2.2);
      lean.forEach((to) => to(skew));
      settle?.kill();
      settle = gsap.delayedCall(0.12, () => lean.forEach((to) => to(0)));
    };
    onScroll();
    rail.addEventListener("scroll", onScroll, { passive: true });

    const offs: Array<() => void> = [];
    if (!reduced)
      cards.forEach((card) => {
        const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3.out" });
        const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          const r = card.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width;
          const ny = (e.clientY - r.top) / r.height;
          rx((0.5 - ny) * 7);
          ry((nx - 0.5) * 9);
          card.style.setProperty("--gx", `${nx * 100}%`);
          card.style.setProperty("--gy", `${ny * 100}%`);
        };
        const leave = () => {
          rx(0);
          ry(0);
        };
        gsap.set(card, { transformPerspective: 900 });
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerleave", leave);
        offs.push(() => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerleave", leave);
        });
      });

    return () => {
      rail.removeEventListener("scroll", onScroll);
      settle?.kill();
      offs.forEach((off) => off());
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: "transform" });
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
