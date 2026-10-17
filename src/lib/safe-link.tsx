import * as React from "react";

// Allowlist for outbound links. Anything not on this list is blocked at click time
// so we never ship a dead or unsafe link to the user.
const ALLOWED_HOSTS = [
  "congress.gov",
  "legiscan.com",
  "ap.org",
  "apnews.com",
  "news.google.com",
  "google.com",
  "senate.gov",
  "house.gov",
  "govinfo.gov",
];

export function isSafeExternalUrl(input: string | null | undefined): boolean {
  if (!input) return false;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

function hostFor(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    return new URL(input).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export type SafeExternalLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  fallbackText?: string;
};

export function SafeExternalLink({
  href,
  children,
  fallbackText = "source unavailable",
  className,
  style,
  ...rest
}: SafeExternalLinkProps) {
  const safe = isSafeExternalUrl(href);
  if (!safe) {
    const host = hostFor(href);
    const reason = host
      ? `Link to ${host} blocked — host is not on the verified source allowlist.`
      : "Link blocked — invalid or unverified URL.";
    return (
      <span
        role="link"
        aria-disabled="true"
        tabIndex={0}
        title={reason}
        aria-label={`${fallbackText}. ${reason}`}
        className={className}
        style={{
          ...style,
          opacity: 0.55,
          cursor: "not-allowed",
          textDecoration: "line-through",
          textDecorationStyle: "dotted",
        }}
      >
        {fallbackText}
        <span aria-hidden="true" style={{ marginLeft: 4, fontSize: "0.85em" }}>
          ⊘
        </span>
      </span>
    );
  }
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={rest.title ?? `Opens ${hostFor(href)} in a new tab`}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
