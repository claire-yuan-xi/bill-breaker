// Pure helpers for the cached-analysis badge on the bill page.
// Kept separate from the route file so tests can import without dragging in
// TanStack route side effects.

export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "earlier";
  const diff = Math.max(0, (Date.now() - t) / 1000);
  if (diff < 45) return "just now";
  if (diff < 90) return "a minute ago";
  if (diff < 3600) {
    const m = Math.round(diff / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 5400) return "an hour ago";
  if (diff < 86400) {
    const h = Math.round(diff / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 172800) return "yesterday";
  if (diff < 7 * 86400) {
    const d = Math.round(diff / 86400);
    return `${d} days ago`;
  }
  if (diff < 30 * 86400) {
    const w = Math.round(diff / (7 * 86400));
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  const mo = Math.round(diff / (30 * 86400));
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export type CachedBadge = { label: string; action: string | null };

/**
 * Maps `cached_reason` from /api/explain-bill into a user-visible badge label
 * and an actionable banner explaining what happened and what to do next.
 */
export function cachedBadgeText(reason: string | null, cachedAt: string | null): CachedBadge {
  const when = cachedAt ? formatRelative(cachedAt) : null;
  const time = when ? ` from ${when}` : "";
  if (reason === "rate_limited") {
    return {
      label: `Cached analysis${time}`,
      action: "AI rate limit hit — showing your last successful analysis. Retry in a minute.",
    };
  }
  if (reason === "ai_unavailable") {
    return {
      label: `Cached analysis${time}`,
      action:
        "AI is temporarily unavailable — showing your last successful analysis. Retry shortly.",
    };
  }
  return { label: `Cached analysis${time}`, action: null };
}
