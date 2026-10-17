import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";
import { startPaperFall } from "@/lib/paper-fall";
import { watchOverlap } from "@/lib/overlap-watch";

/**
 * A printed bill that drifts down the page as you scroll, as if it fell from
 * the dome. Purely decorative: aria-hidden, never takes pointer events, and it
 * fades out whenever it would sit over anything in `avoid` (sections or buttons).
 */
export function BillDrift({ avoid }: { avoid: string[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrap.current || !sheet.current || prefersReducedMotion()) return;
    const fall = startPaperFall({ wrap: wrap.current, sheet: sheet.current, sheen: sheen.current });
    const page = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => fall.setProgress(self.progress),
    });
    fall.setProgress(page.progress);
    // Measured against the sheet itself (it is fixed, so its rect never goes stale),
    // so it steps aside for news, saved bills and buttons wherever they end up.
    const stopWatch = watchOverlap(sheet.current, avoid, (hit) =>
      gsap.to(wrap.current, {
        autoAlpha: hit ? 0 : 1,
        duration: 0.6,
        ease: "power2.out",
        overwrite: "auto",
      }),
    );
    return () => {
      fall.stop();
      page.kill();
      stopWatch();
    };
  }, [avoid.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className="pointer-events-none fixed right-[7vw] top-0 z-30 hidden [perspective:900px] motion-reduce:hidden lg:block"
    >
      <div
        ref={sheet}
        className="bill-paper relative w-[168px] origin-center px-4 pb-6 pt-4 text-[#2b2b2b] shadow-[0_30px_50px_-20px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.12)] [transform-style:preserve-3d]"
      >
        <div
          ref={sheen}
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.7)_0%,rgba(255,255,255,0)_45%,rgba(0,0,0,0.08)_100%)] opacity-20"
        />
        <div className="flex justify-between font-serif text-[7px] uppercase tracking-[0.12em] text-[#555]">
          <span>119th Congress</span>
          <span>2d Session</span>
        </div>
        <div className="mt-2 text-center font-serif text-[15px] font-semibold leading-none">
          H. R. 2026
        </div>
        <div className="mt-2 border-t border-[#2b2b2b]/40 pt-1.5 text-center font-serif text-[7px] uppercase tracking-[0.14em]">
          In the House of Representatives
        </div>
        <div className="mt-2 text-center font-serif text-[18px] font-bold tracking-[0.3em]">
          A BILL
        </div>
        <p className="mt-1.5 font-serif text-[8px] leading-[13px] text-[#444]">
          To make every bill readable by the people it affects, and for other purposes.
        </p>
        <p className="mt-2 font-serif text-[7.5px] leading-[14px] text-[#555]">
          <span className="font-semibold">Be it enacted</span> by the Senate and House of
          Representatives of the United States of America in Congress assembled,
        </p>
        <div className="mt-2 space-y-[9px]">
          {[92, 100, 84, 96, 70].map((w, i) => (
            <div key={i} className="h-[2px] bg-[#2b2b2b]/20" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="absolute left-1.5 top-[118px] space-y-[9px] font-serif text-[5px] text-[#999]">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
