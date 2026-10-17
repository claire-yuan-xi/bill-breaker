export function formatTime(s: string) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function cleanTitle(t: string) {
  return t.replace(/ - [^-]+$/, "");
}

// Feed links are already decoded to apnews.com on the server; only route
// anything else through the resolver.
export function articleHref(link: string) {
  try {
    const host = new URL(link).hostname;
    if (host === "apnews.com" || host.endsWith(".apnews.com")) return link;
  } catch {
    // fall through to the resolver
  }
  return `/api/public/resolve?url=${encodeURIComponent(link)}`;
}

/** Rough topic tag from the headline, so cards are scannable at a glance. */
const TOPICS: Array<[RegExp, string]> = [
  [/supreme court|justice|court|judge|ruling/i, "Courts"],
  [/senate|senator/i, "Senate"],
  [/\bhouse\b|speaker|representative/i, "House"],
  [/election|midterm|ballot|vote|campaign|primary/i, "Elections"],
  [/budget|tax|tariff|spending|shutdown|debt/i, "Money"],
  [/immigra|border|asylum|deport/i, "Immigration"],
  [/health|medicaid|medicare|abortion|drug/i, "Health"],
  [/school|education|student/i, "Education"],
  [/climate|energy|environment|oil|gas/i, "Environment"],
  [/governor|state|legislature|statehouse/i, "States"],
];

export function topicFor(title: string) {
  return TOPICS.find(([re]) => re.test(title))?.[1] ?? "Policy";
}
