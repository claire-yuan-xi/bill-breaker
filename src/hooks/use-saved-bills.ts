import { useSyncExternalStore } from "react";
import { WATCH_KEY, readWatchlist, subscribeWatchlist, type WatchItem } from "@/lib/watchlist";

const EMPTY: WatchItem[] = [];
let lastRaw: string | null = null;
let lastList: WatchItem[] = EMPTY;

// useSyncExternalStore needs the same array back until the data really changes.
function snapshot(): WatchItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WATCH_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastList = raw ? readWatchlist() : EMPTY;
  }
  return lastList;
}

/** Live list of saved bills, newest first. Empty during server render. */
export function useSavedBills(): WatchItem[] {
  return useSyncExternalStore(subscribeWatchlist, snapshot, () => EMPTY);
}
