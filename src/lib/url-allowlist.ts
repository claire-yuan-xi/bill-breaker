// Single source of truth for the resolver allowlist. Exported so tests can
// hit it without spinning up a TanStack server route.
export const ALLOWED_RESOLVE_HOSTS = ["apnews.com", "news.google.com", "google.com"];

export function isAllowedResolveHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_RESOLVE_HOSTS.some((d) => h === d || h.endsWith("." + d));
}
