import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { usePress } from "@/lib/press";
import { usePhotoScene } from "./use-photo-scene";

type Props = { onSearch: () => void; onPaste: () => void };

// Public-domain photograph; see public/images/CREDITS.md for source and license.
const PHOTO = "/images/capitol.jpg";
// Depth (red) and sky mask (green) for the same photo; regenerate if the photo changes.
const DEPTH = "/images/capitol-depth.png";
const PHOTO_SCENE = {
  src: PHOTO,
  depthSrc: DEPTH,
  focus: [0.5, 0.62] as [number, number],
  // Matches the <img> object-position below: 50%/38% across, 40% down.
  anchorFor: (w: number): [number, number] => (w >= 768 ? [0.38, 0.6] : [0.5, 0.6]),
};

export function CapitolHero({ onSearch, onPaste }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchRef = usePress<HTMLButtonElement>({ magnetic: true });
  const pasteRef = usePress<HTMLButtonElement>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // A cached photo can finish loading before hydration, so onLoad never fires; check on mount.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, []);
  // Once the WebGL pass is drawing, it owns depth, camera motion, light and dusk.
  const deep = usePhotoScene(canvasRef, sectionRef, PHOTO_SCENE);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      // Slow establishing push-in, like a camera on a long lens settling.
      gsap.fromTo("[data-photo]", { scale: 1.16 }, { scale: 1.04, duration: 7, ease: "expo.out" });
      gsap.fromTo(
        "[data-hero-line]",
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.1, delay: 0.3 },
      );
      gsap.fromTo(
        "[data-hero-fade]",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power2.out", stagger: 0.08, delay: 0.8 },
      );

      // Scroll: the photo sinks (parallax), the light turns to dusk, the copy lifts away.
      const scrub = {
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      };
      gsap.to(photoRef.current, { yPercent: 14, ease: "none", scrollTrigger: scrub });
      gsap.to("[data-dusk]", { opacity: 1, ease: "none", scrollTrigger: scrub });
      gsap.to(copyRef.current, {
        yPercent: -16,
        opacity: 0,
        ease: "none",
        scrollTrigger: { ...scrub, end: "70% top", scrub: 0.8 },
      });
    }, sectionRef);

    // A little depth under the pointer.
    const photo = photoRef.current;
    const toX = photo ? gsap.quickTo(photo, "x", { duration: 1.6, ease: "power3.out" }) : null;
    const toR = photo
      ? gsap.quickTo(photo, "rotationY", { duration: 1.6, ease: "power3.out" })
      : null;
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      toX?.(nx * -24);
      toR?.(nx * 1.2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative isolate h-[100svh] min-h-[620px] overflow-hidden bg-[#1c2230] text-white [perspective:1200px]"
    >
      <div
        ref={photoRef}
        aria-hidden="true"
        className={
          "absolute -inset-x-8 -bottom-[14%] -top-8 transition-opacity duration-[1600ms] will-change-transform " +
          (deep ? "opacity-0" : "opacity-100")
        }
      >
        {!failed && (
          <img
            ref={imgRef}
            data-photo
            src={PHOTO}
            alt=""
            fetchPriority="high"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={
              "h-full w-full object-cover object-[50%_40%] transition-opacity duration-1000 " +
              (loaded ? "opacity-100" : "opacity-0")
            }
          />
        )}
        {/* Cloud shadows drifting across the stone. */}
        <div className="hero-clouds absolute inset-0 mix-blend-multiply" />
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={
          "absolute inset-0 h-full w-full transition-opacity duration-[1600ms] ease-out " +
          (deep ? "opacity-100" : "opacity-0")
        }
      />
      {/* Fallback sky while the photo loads, or if it can't. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_70%_20%,#f3c99a_0%,#93a9c6_45%,#2b3448_100%)]"
      />
      <div
        data-dusk
        aria-hidden="true"
        className={
          (deep ? "hidden " : "") +
          "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,150,70,0.28)_0%,rgba(120,40,60,0.35)_60%,rgba(20,20,40,0.6)_100%)] opacity-0 mix-blend-multiply"
        }
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_55%,rgba(14,17,24,0)_0%,rgba(14,17,24,0.55)_100%),linear-gradient(0deg,rgba(14,17,24,0.7)_0%,rgba(14,17,24,0)_40%)]"
      />

      <div
        ref={copyRef}
        className="relative mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-6 pt-24 text-center"
      >
        <h1
          id="hero-title"
          className="font-serif text-6xl font-bold leading-[0.95] tracking-tight mix-blend-overlay md:text-9xl"
        >
          <span className="block overflow-hidden pb-1">
            <span data-hero-line className="block">
              Legislation,
            </span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span data-hero-line className="block">
              in plain English.
            </span>
          </span>
        </h1>

        <div data-hero-fade className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <button
            ref={searchRef}
            type="button"
            onClick={onSearch}
            className="group relative inline-flex items-center justify-between gap-10 overflow-hidden bg-white px-8 py-6 text-[#14171f] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:min-w-[360px]"
          >
            <span className="font-serif text-3xl font-bold md:text-4xl">Search a bill</span>
            <span
              data-press-arrow
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-[#14171f]"
            >
              →
            </span>
          </button>
          <button
            ref={pasteRef}
            type="button"
            onClick={onPaste}
            className="relative overflow-hidden border border-white/40 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-white hover:border-white"
          >
            Paste text
          </button>
        </div>
      </div>
    </section>
  );
}
