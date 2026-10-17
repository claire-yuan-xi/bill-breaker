/**
 * Standard security response headers applied to every server response by the
 * request middleware in `src/start.ts`.
 *
 * CSP is intentionally permissive for inline scripts/styles because TanStack
 * Start's hydration payload and Tailwind's runtime styles are emitted inline.
 * It still constrains script/style/font/connect origins, blocks plugin/object
 * embeds, forbids mixed content, and locks down `base-uri` and `form-action`.
 */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.congress.gov",
    "https://www.govinfo.gov",
    "https://v3.openstates.org",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "upgrade-insecure-requests": [],
};

export function buildCsp(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/**
 * Mutates the response headers in place to add the standard security headers.
 * CSP is only set on HTML responses to avoid breaking JSON APIs and fonts.
 */
export function applySecurityHeaders(response: Response): Response {
  try {
    const h = response.headers;
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (!h.has(k)) h.set(k, v);
    }
    const contentType = h.get("content-type") || "";
    if (contentType.includes("text/html") && !h.has("Content-Security-Policy")) {
      h.set("Content-Security-Policy", buildCsp());
    }
  } catch {
    // headers may be immutable on some Response subclasses — never throw from middleware
  }
  return response;
}
