import { gsap } from "@/lib/motion";

/**
 * Calls `onChange(true)` while `el` overlaps any element matching `selectors`
 * on screen, and `onChange(false)` once it is clear. Checks a few times a
 * second on GSAP's ticker, so it keeps up with scrolling and layout changes
 * without listening to anything. Returns a stop function.
 */
export function watchOverlap(
  el: HTMLElement,
  selectors: string[],
  onChange: (overlapping: boolean) => void,
  margin = 24,
) {
  let frame = 0;
  let state: boolean | null = null;
  const query = selectors.join(",");
  const tick = () => {
    if (++frame % 6) return;
    const a = el.getBoundingClientRect();
    let hit = false;
    for (const other of document.querySelectorAll(query)) {
      const b = other.getBoundingClientRect();
      if (
        a.right + margin > b.left &&
        a.left - margin < b.right &&
        a.bottom + margin > b.top &&
        a.top - margin < b.bottom
      ) {
        hit = true;
        break;
      }
    }
    if (hit !== state) {
      state = hit;
      onChange(hit);
    }
  };
  gsap.ticker.add(tick);
  return () => gsap.ticker.remove(tick);
}
