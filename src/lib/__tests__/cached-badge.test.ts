import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelative, cachedBadgeText } from "@/lib/cached-badge";

afterEach(() => vi.useRealTimers());

describe("formatRelative — clearer timing units", () => {
  it("returns 'just now' for <45s", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    vi.useFakeTimers().setSystemTime(now);
    expect(formatRelative(new Date(now.getTime() - 5_000).toISOString())).toBe("just now");
  });

  it("uses minute granularity under an hour", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    vi.useFakeTimers().setSystemTime(now);
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000).toISOString())).toBe(
      "5 minutes ago",
    );
    expect(formatRelative(new Date(now.getTime() - 60_000).toISOString())).toBe("a minute ago");
  });

  it("uses hour granularity under a day", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    vi.useFakeTimers().setSystemTime(now);
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000).toISOString())).toBe(
      "3 hours ago",
    );
    expect(formatRelative(new Date(now.getTime() - 3600_000).toISOString())).toBe("an hour ago");
  });

  it("uses day/week/month granularity", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    vi.useFakeTimers().setSystemTime(now);
    expect(formatRelative(new Date(now.getTime() - 26 * 3600_000).toISOString())).toBe("yesterday");
    expect(formatRelative(new Date(now.getTime() - 3 * 86400_000).toISOString())).toBe(
      "3 days ago",
    );
    expect(formatRelative(new Date(now.getTime() - 14 * 86400_000).toISOString())).toBe(
      "2 weeks ago",
    );
    expect(formatRelative(new Date(now.getTime() - 90 * 86400_000).toISOString())).toBe(
      "3 months ago",
    );
  });

  it("returns 'earlier' for unparseable input", () => {
    expect(formatRelative("not-a-date")).toBe("earlier");
  });
});

describe("cachedBadgeText — actionable messaging per reason", () => {
  it("rate_limited surfaces a retry-in-a-minute action", () => {
    const r = cachedBadgeText("rate_limited", new Date(Date.now() - 60_000).toISOString());
    expect(r.label).toMatch(/Cached analysis from/);
    expect(r.action).toMatch(/rate limit/i);
    expect(r.action).toMatch(/Retry/i);
  });

  it("ai_unavailable surfaces a temporary-outage action", () => {
    const r = cachedBadgeText("ai_unavailable", new Date(Date.now() - 3 * 3600_000).toISOString());
    expect(r.label).toMatch(/hours ago/);
    expect(r.action).toMatch(/temporarily unavailable/i);
  });

  it("unknown reason has no action banner", () => {
    const r = cachedBadgeText(null, new Date().toISOString());
    expect(r.action).toBeNull();
    expect(r.label).toMatch(/Cached analysis/);
  });

  it("missing cachedAt still produces a clean label", () => {
    const r = cachedBadgeText("rate_limited", null);
    expect(r.label).toBe("Cached analysis");
    expect(r.action).toMatch(/rate limit/i);
  });
});
