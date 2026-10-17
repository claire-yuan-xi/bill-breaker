import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RateLimitResult = { allowed: boolean; retryAfter: number; count: number };
export type AbuseReason = "limit_exceeded" | "near_limit" | "rpc_error" | "exception";

/**
 * Token bucket via Postgres RPC. Fails closed (blocks the caller) if the RPC
 * errors so a database outage cannot be used to bypass throttling.
 *
 * Emits a structured `[abuse]` JSON log line whenever a caller is blocked or
 * approaches the limit, persists the event to `abuse_events` for the admin
 * debugging page, and (when configured) fires a webhook alert after a sustained
 * burst — all isolated from the request path so monitoring failures never
 * affect the user.
 */
export async function bumpRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
  meta?: { endpoint?: string },
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc("bump_rate_limit", {
      _identifier: identifier,
      _window_seconds: windowSeconds,
      _limit: limit,
    });
    if (error) {
      console.error("[rate-limit] RPC error:", error.message);
      void recordAndLog({
        identifier,
        limit,
        windowSeconds,
        count: 0,
        reason: "rpc_error",
        endpoint: meta?.endpoint,
      });
      return { allowed: false, retryAfter: 60, count: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    const allowed = !!row?.allowed;
    const count = Number(row?.current_count ?? 0);
    const retryAfter = row?.window_end
      ? Math.max(1, Math.ceil((new Date(row.window_end).getTime() - Date.now()) / 1000))
      : windowSeconds;
    if (!allowed) {
      void recordAndLog({
        identifier,
        limit,
        windowSeconds,
        count,
        reason: "limit_exceeded",
        endpoint: meta?.endpoint,
      });
      void maybeAlert({
        identifier,
        limit,
        windowSeconds,
        count,
        reason: "limit_exceeded",
        endpoint: meta?.endpoint,
      });
    } else if (count >= Math.floor(limit * 0.8)) {
      void recordAndLog({
        identifier,
        limit,
        windowSeconds,
        count,
        reason: "near_limit",
        endpoint: meta?.endpoint,
      });
    }
    return { allowed, retryAfter, count };
  } catch (e) {
    console.error("[rate-limit] unexpected error:", e);
    void recordAndLog({
      identifier,
      limit,
      windowSeconds,
      count: 0,
      reason: "exception",
      endpoint: meta?.endpoint,
    });
    void maybeAlert({
      identifier,
      limit,
      windowSeconds,
      count: 0,
      reason: "exception",
      endpoint: meta?.endpoint,
    });
    return { allowed: false, retryAfter: 60, count: 0 };
  }
}

/** Extract a best-effort client IP from common edge / proxy headers. */
export function clientIpFromRequest(req: Request): string {
  const h = req.headers;
  const candidates = [
    h.get("cf-connecting-ip"),
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    h.get("forwarded")?.match(/for="?([^;",\s]+)/i)?.[1],
  ];
  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 64) return c;
  }
  return "unknown";
}

type AbuseInfo = {
  identifier: string;
  limit: number;
  windowSeconds: number;
  count: number;
  reason: AbuseReason;
  endpoint?: string;
  meta?: Record<string, unknown>;
};

/**
 * Structured one-line JSON log for rate-limit events. Greppable as
 * `[abuse]` and shaped for alerting rules of the form
 * "more than N events from the same identifier in M minutes".
 */
export function logAbuse(info: AbuseInfo): void {
  try {
    const entry = {
      evt: "abuse",
      ts: new Date().toISOString(),
      identifier: info.identifier,
      endpoint: info.endpoint,
      limit: info.limit,
      window_s: info.windowSeconds,
      count: info.count,
      reason: info.reason,
      ...(info.meta ?? {}),
    };
    console.warn(`[abuse] ${JSON.stringify(entry)}`);
  } catch {
    // never throw from a logger
  }
}

/** Log + best-effort persist to abuse_events (failures are swallowed). */
async function recordAndLog(info: AbuseInfo): Promise<void> {
  logAbuse(info);
  try {
    await supabaseAdmin.from("abuse_events").insert({
      identifier: info.identifier,
      endpoint: info.endpoint ?? null,
      reason: info.reason,
      count: info.count,
      limit_value: info.limit,
      window_seconds: info.windowSeconds,
      meta: (info.meta ?? {}) as never,
    });
  } catch (e) {
    console.error("[abuse-events] insert failed:", e);
  }
}

/**
 * One-time config check. Logs a clear warning if ABUSE_ALERT_WEBHOOK_URL is
 * set to an obviously wrong value (non-https, non-URL). Missing is fine —
 * alerting is opt-in.
 */
let _webhookChecked = false;
function checkWebhookConfig(): string | null {
  const url = process.env.ABUSE_ALERT_WEBHOOK_URL;
  if (!_webhookChecked) {
    _webhookChecked = true;
    if (!url) {
      console.info(
        "[abuse-alert] ABUSE_ALERT_WEBHOOK_URL not set — webhook alerts disabled. Rate limiting and logs still work.",
      );
    } else {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:") {
          console.warn(
            `[abuse-alert] ABUSE_ALERT_WEBHOOK_URL must use https (got ${u.protocol}). Alerts disabled.`,
          );
          return null;
        }
      } catch {
        console.warn("[abuse-alert] ABUSE_ALERT_WEBHOOK_URL is not a valid URL. Alerts disabled.");
        return null;
      }
    }
  }
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * POST with bounded retries and exponential backoff. Wraps each attempt in
 * AbortController so a hung webhook can't pile up. Never throws — callers
 * decide whether to ignore failures (they always should for monitoring).
 */
export async function postWebhookWithRetry(
  url: string,
  body: unknown,
  opts: { attempts?: number; baseDelayMs?: number; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status?: number; attempts: number; error?: string }> {
  const attempts = Math.max(1, Math.min(5, opts.attempts ?? 3));
  const baseDelay = Math.max(50, opts.baseDelayMs ?? 250);
  const timeoutMs = Math.max(500, opts.timeoutMs ?? 4000);
  let lastErr: string | undefined;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      // 2xx = success. 4xx (except 408/429) = don't retry. 5xx/408/429 = retry.
      if (res.ok) return { ok: true, status: res.status, attempts: i + 1 };
      const retriable = res.status >= 500 || res.status === 408 || res.status === 429;
      if (!retriable) return { ok: false, status: res.status, attempts: i + 1 };
      lastErr = `http_${res.status}`;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? e.name : "network_error";
    }
    if (i < attempts - 1) {
      const delay = baseDelay * 2 ** i + Math.floor(Math.random() * baseDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return { ok: false, attempts, error: lastErr };
}

/**
 * Threshold-based alerting hook. Fires when the same identifier has been
 * rate-limited repeatedly within a short window. Posts to ABUSE_ALERT_WEBHOOK_URL
 * if configured (Slack/Discord/Sentry webhook, etc.). Counts are tracked
 * in the existing rate_limits Postgres table via bump_rate_limit, so the
 * threshold survives across Worker invocations.
 *
 * Configuration (all optional; missing → safe defaults, no alerts):
 *   ABUSE_ALERT_WEBHOOK_URL    - HTTPS endpoint to POST alerts to (required to enable)
 *   ABUSE_ALERT_THRESHOLD      - incidents per hour before alerting (default 5)
 *   ABUSE_ALERT_COOLDOWN_S     - min seconds between alerts per identifier (default 3600)
 *
 * Behavior when webhook URL is missing or invalid: function is a no-op.
 * Behavior when webhook endpoint is down: retries with exponential backoff
 * up to 3 times, then gives up silently. Rate limiting is unaffected.
 */
export async function maybeAlert(info: {
  identifier: string;
  limit: number;
  windowSeconds: number;
  count: number;
  reason: "limit_exceeded" | "exception";
  endpoint?: string;
}): Promise<void> {
  const webhook = checkWebhookConfig();
  if (!webhook) return;
  const threshold = Math.max(1, Number(process.env.ABUSE_ALERT_THRESHOLD ?? 5));
  const cooldown = Math.max(60, Number(process.env.ABUSE_ALERT_COOLDOWN_S ?? 3600));
  try {
    // Count incidents for this identifier in the last hour.
    const incidentKey = `abuse-incident:${info.identifier}`;
    const { data: incData, error: incErr } = await supabaseAdmin.rpc("bump_rate_limit", {
      _identifier: incidentKey,
      _window_seconds: 3600,
      _limit: 1_000_000, // never block; we just want the count
    });
    if (incErr) return;
    const incRow = Array.isArray(incData) ? incData[0] : incData;
    const incidentCount = Number(incRow?.current_count ?? 0);
    if (incidentCount < threshold) return;

    // Cooldown gate so we don't spam the webhook.
    const cooldownKey = `abuse-alert:${info.identifier}`;
    const { data: cdData, error: cdErr } = await supabaseAdmin.rpc("bump_rate_limit", {
      _identifier: cooldownKey,
      _window_seconds: cooldown,
      _limit: 1,
    });
    if (cdErr) return;
    const cdRow = Array.isArray(cdData) ? cdData[0] : cdData;
    if (!cdRow?.allowed) return;

    const payload = {
      text: `[abuse-alert] ${info.identifier} hit rate limits ${incidentCount}x in last hour (reason=${info.reason}, endpoint=${info.endpoint ?? "?"}, limit=${info.limit}/${info.windowSeconds}s)`,
      identifier: info.identifier,
      endpoint: info.endpoint,
      incident_count: incidentCount,
      threshold,
      window_hours: 1,
      reason: info.reason,
      limit: info.limit,
      window_seconds: info.windowSeconds,
      ts: new Date().toISOString(),
    };
    const result = await postWebhookWithRetry(webhook, payload);
    if (!result.ok) {
      console.error(
        `[abuse-alert] webhook failed after ${result.attempts} attempts: ${result.error ?? result.status}`,
      );
    }
  } catch (e) {
    console.error("[abuse-alert] failed:", e);
  }
}
