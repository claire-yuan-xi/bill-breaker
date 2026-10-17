import { useEffect, useState, type RefObject } from "react";
import { ScrollTrigger, prefersReducedMotion } from "@/lib/motion";
import type { PhotoOptions } from "@/components/capitol/photo-scene";

type Config = Omit<PhotoOptions, "reducedMotion" | "onReady" | "onError">;

/**
 * Mounts the WebGL photo pass on `canvas`, driven by the scroll through
 * `section`. Returns true once the first frame is on screen, so the plain
 * <img> underneath can hand over. Stays false (and the <img> keeps working)
 * when WebGL is missing or the photo fails to load.
 */
export function usePhotoScene(
  canvas: RefObject<HTMLCanvasElement | null>,
  section: RefObject<HTMLElement | null>,
  config: Config,
) {
  const [ready, setReady] = useState(false);
  const { src, depthSrc } = config;

  useEffect(() => {
    const el = canvas.current;
    const trigger = section.current;
    if (!el || !trigger) return;
    let disposed = false;
    let handle: { setProgress(p: number): void; dispose(): void } | null = null;
    let st: ScrollTrigger | null = null;

    import("@/components/capitol/photo-scene").then(({ mountPhoto }) => {
      if (disposed) return;
      try {
        handle = mountPhoto(el, {
          ...config,
          reducedMotion: prefersReducedMotion(),
          onReady: () => setReady(true),
          onError: () => setReady(false),
        });
      } catch {
        return;
      }
      st = ScrollTrigger.create({
        trigger,
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => handle?.setProgress(self.progress),
      });
      handle.setProgress(st.progress);
    });

    return () => {
      disposed = true;
      st?.kill();
      handle?.dispose();
    };
  }, [canvas, section, src, depthSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  return ready;
}
