import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WATCH_KEY,
  readWatchlist,
  writeWatchlist,
  buildBackup,
  serializeBackup,
  parseBackup,
  mergeWatchlist,
  clearWatchlist,
  isValidItem,
} from "../watchlist";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
}

beforeEach(() => {
  // jsdom provides localStorage; reset between tests in any env.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = new MemoryStorage();
});

const A = { state: "US", bill_no: "HR1", title: "Test Bill A", ts: 1_000 };
const B = { state: "CA", bill_no: "AB100", title: "Test Bill B", ts: 2_000 };

describe("watchlist helpers", () => {
  it("validates well-formed items and rejects malformed ones", () => {
    expect(isValidItem(A)).toBe(true);
    expect(isValidItem({ ...A, state: "" })).toBe(false);
    expect(isValidItem({ ...A, bill_no: "💣" })).toBe(false);
    expect(isValidItem(null)).toBe(false);
  });

  it("round-trips through write/read", () => {
    writeWatchlist([A, B]);
    expect(readWatchlist()).toEqual([A, B]);
  });

  it("serializes a backup with version + items", () => {
    writeWatchlist([A]);
    const json = serializeBackup();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.items).toEqual([A]);
    expect(typeof parsed.exportedAt).toBe("number");
  });

  it("parses both a wrapped backup and a raw item array", () => {
    expect(parseBackup(JSON.stringify(buildBackup([A])))).toEqual([A]);
    expect(parseBackup(JSON.stringify([A, B]))).toEqual([A, B]);
  });

  it("throws on garbage input", () => {
    expect(() => parseBackup("not json")).toThrow();
    expect(() => parseBackup(JSON.stringify({ wat: true }))).toThrow();
  });

  it("merge: adds new items and dedupes by (state, bill_no)", () => {
    writeWatchlist([A]);
    const res = mergeWatchlist([B, A]);
    expect(res.added).toBe(1);
    expect(res.skipped).toBeGreaterThanOrEqual(1);
    const items = readWatchlist();
    expect(items.map((i) => i.bill_no).sort()).toEqual(["AB100", "HR1"]);
  });

  it("merge: keeps the newer timestamp", () => {
    writeWatchlist([{ ...A, title: "Old", ts: 100 }]);
    const res = mergeWatchlist([{ ...A, title: "New", ts: 999 }]);
    expect(res.merged).toBe(1);
    const items = readWatchlist();
    expect(items[0].title).toBe("New");
    expect(items[0].ts).toBe(999);
  });

  it("clearWatchlist empties storage", () => {
    writeWatchlist([A, B]);
    clearWatchlist();
    expect(readWatchlist()).toEqual([]);
    expect(localStorage.getItem(WATCH_KEY)).toBeNull();
  });

  it("readWatchlist tolerates corrupted JSON", () => {
    localStorage.setItem(WATCH_KEY, "{not json");
    expect(readWatchlist()).toEqual([]);
  });

  it("ignores malformed items during import (does not corrupt list)", () => {
    writeWatchlist([A]);
    mergeWatchlist([{ state: "??", bill_no: "💣", title: 5 } as unknown as typeof A]);
    expect(readWatchlist()).toEqual([A]);
  });
});

describe("watchlist storage is import-safe in non-browser env", () => {
  it("read/write are silent no-ops when localStorage is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (globalThis as any).localStorage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
    try {
      expect(readWatchlist()).toEqual([]);
      expect(() => writeWatchlist([A])).not.toThrow();
      expect(() => clearWatchlist()).not.toThrow();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).localStorage = original;
    }
  });
});

// Silence noisy console errors during error-path tests.
vi.spyOn(console, "error").mockImplementation(() => {});
