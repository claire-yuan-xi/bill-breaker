import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Eased page scrolling, driven by GSAP's ticker so ScrollTrigger scrubs read the
 * same scroll position Lenis renders. Native scrolling is untouched for touch,
 * keyboard, find-in-page and anchors, and the whole thing is off when the reader
 * prefers reduced motion.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.9,
      // The news rail and any scrollable dialog keep their own native scrolling.
      allowNestedScroll: true,
      autoRaf: false,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Radix dialogs lock the body; hold the page still underneath them.
    const body = document.body;
    const sync = () => (body.hasAttribute("data-scroll-locked") ? lenis.stop() : lenis.start());
    const mo = new MutationObserver(sync);
    mo.observe(body, { attributes: true, attributeFilter: ["data-scroll-locked", "style"] });

    return () => {
      mo.disconnect();
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);
}
