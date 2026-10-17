// Local anonymous watchlist storage + portable backup format.
// Cloud sync is optional and keyed by an opaque per-device id.

export const WATCH_KEY = "bb_watchlist_v1";
export const DEVICE_KEY = "bb_device_id_v1";
export const WATCH_BACKUP_VERSION = 1;

export type WatchItem = {
  state: string;
  bill_no: string;
  title: string;
  ts: number;
};

export type WatchBackup = {
  version: number;
  exportedAt: number;
  device_id?: string;
  items: WatchItem[];
};

const STATE_RE = /^[A-Z]{2,4}$/;
const BILL_NO_RE = /^[A-Za-z]{1,8}[.\s-]?\d{1,6}$/;
const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readWatchlist(): WatchItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
  } catch {
    return [];
  }
}

export function writeWatchlist(items: WatchItem[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    /* quota or disabled — ignore */
  }
  announce();
}

// Same-tab listeners. The browser's "storage" event only fires in *other* tabs.
const CHANGE_EVENT = "bb:watchlist";

function announce() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls `cb` whenever the saved list changes, in this tab or another one. */
export function subscribeWatchlist(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === WATCH_KEY || e.key === null) cb();
  };
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function isSaved(state: string, billNo: string, list: WatchItem[] = readWatchlist()) {
  return list.some((w) => w.state === state && w.bill_no === billNo);
}

/** Adds (or bumps to the top) one bill. Returns the stored item. */
export function saveBill(state: string, billNo: string, title: string): WatchItem {
  const item: WatchItem = { state, bill_no: billNo, title, ts: Date.now() };
  const rest = readWatchlist().filter((w) => !(w.state === state && w.bill_no === billNo));
  writeWatchlist([item, ...rest]);
  return item;
}

export function removeBill(state: string, billNo: string) {
  writeWatchlist(readWatchlist().filter((w) => !(w.state === state && w.bill_no === billNo)));
}

/** Puts a removed item back where it was (for "Undo"). */
export function restoreBill(item: WatchItem) {
  const rest = readWatchlist().filter(
    (w) => !(w.state === item.state && w.bill_no === item.bill_no),
  );
  writeWatchlist([...rest, item].sort((a, b) => b.ts - a.ts));
}

/** Refreshes the stored title once the real one is known, without reordering. */
export function retitleBill(state: string, billNo: string, title: string) {
  const list = readWatchlist();
  const hit = list.find((w) => w.state === state && w.bill_no === billNo);
  if (!hit || !title || hit.title === title) return;
  writeWatchlist(list.map((w) => (w === hit ? { ...w, title } : w)));
}

export function isValidItem(x: unknown): x is WatchItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.state === "string" &&
    STATE_RE.test(o.state) &&
    typeof o.bill_no === "string" &&
    BILL_NO_RE.test(o.bill_no) &&
    typeof o.title === "string" &&
    typeof o.ts === "number" &&
    Number.isFinite(o.ts)
  );
}

export function isValidDeviceId(x: unknown): x is string {
  return typeof x === "string" && DEVICE_ID_RE.test(x);
}

function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (RFC4122 v4) — used only in odd environments without crypto.
  const r = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}

/** Returns the current device id, minting one if needed. */
export function getDeviceId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && isValidDeviceId(existing)) return existing;
    const next = randomUUID();
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return "";
  }
}

export function setDeviceId(id: string): boolean {
  if (typeof localStorage === "undefined") return false;
  if (!isValidDeviceId(id)) return false;
  try {
    localStorage.setItem(DEVICE_KEY, id.toLowerCase());
    return true;
  } catch {
    return false;
  }
}

export function buildBackup(items: WatchItem[] = readWatchlist()): WatchBackup {
  const out: WatchBackup = { version: WATCH_BACKUP_VERSION, exportedAt: Date.now(), items };
  const dev = typeof localStorage === "undefined" ? "" : localStorage.getItem(DEVICE_KEY) || "";
  if (isValidDeviceId(dev)) out.device_id = dev;
  return out;
}

export function serializeBackup(items?: WatchItem[]): string {
  return JSON.stringify(buildBackup(items), null, 2);
}

export type ImportResult = {
  added: number;
  merged: number;
  skipped: number;
  total: number;
};

export function parseBackup(json: string): WatchItem[] {
  const data = JSON.parse(json);
  if (data && typeof data === "object" && Array.isArray((data as WatchBackup).items)) {
    return (data as WatchBackup).items.filter(isValidItem);
  }
  // Tolerant: accept a bare array too.
  if (Array.isArray(data)) return data.filter(isValidItem);
  throw new Error("Not a valid watchlist backup");
}

/** Merges imported items with current list, de-duped by (state, bill_no). */
export function mergeWatchlist(incoming: WatchItem[]): ImportResult {
  const current = readWatchlist();
  const byKey = new Map(current.map((i) => [`${i.state}|${i.bill_no}`, i]));
  let added = 0;
  let merged = 0;
  let skipped = 0;
  for (const item of incoming) {
    if (!isValidItem(item)) {
      skipped++;
      continue;
    }
    const key = `${item.state}|${item.bill_no}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      added++;
    } else if (item.ts > existing.ts || (existing.title === "" && item.title)) {
      byKey.set(key, { ...existing, ...item, ts: Math.max(existing.ts, item.ts) });
      merged++;
    } else {
      skipped++;
    }
  }
  const next = [...byKey.values()].sort((a, b) => b.ts - a.ts);
  writeWatchlist(next);
  return { added, merged, skipped, total: next.length };
}

export function clearWatchlist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(WATCH_KEY);
  } catch {
    /* ignore */
  }
  announce();
}

/** Converts rows from the cloud copy into local items. */
export function fromRemoteItems(
  rows: { state: string; bill_no: string; title: string; added_at: string }[],
): WatchItem[] {
  return rows.map((i) => ({
    state: i.state,
    bill_no: i.bill_no,
    title: i.title,
    ts: new Date(i.added_at).getTime() || Date.now(),
  }));
}
