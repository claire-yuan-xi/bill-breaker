import { useCallback, useEffect, useRef, useState } from "react";
import type { WatchItem } from "@/lib/watchlist";

export type Notice = { text: string; undo?: WatchItem };

/** A short-lived status message; ones with an Undo stay up a little longer. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = useCallback((n: Notice) => {
    window.clearTimeout(timer.current);
    setNotice(n);
    timer.current = window.setTimeout(() => setNotice(null), n.undo ? 7000 : 4000);
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);
  return { notice, show, dismiss };
}
