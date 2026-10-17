# Abuse Monitoring & Alerting

This app is anonymous-by-design — there are no user accounts gating
`/api/explain-bill`, watchlist sync, or publishing. Abuse is detected with
per-IP rate limits backed by Postgres (`bump_rate_limit` RPC). This doc
describes the optional alerting and admin-debug surface layered on top.

## What's always on

- **Per-IP rate limits** on writes / AI calls. Failures are _fail-closed_
  (block the request) so a DB outage can't be used to bypass throttling.
- **Structured logs.** Every `near_limit`, `limit_exceeded`, `rpc_error`,
  and `exception` is written as a single JSON line prefixed `[abuse]`.
  Greppable in any log drain.
- **Event persistence.** The same events are inserted into the
  `abuse_events` table (service-role only) for the admin debug page.

## Optional configuration (secrets)

| Secret                    | Required?                | Default                | Purpose                                                       |
| ------------------------- | ------------------------ | ---------------------- | ------------------------------------------------------------- |
| `ABUSE_ALERT_WEBHOOK_URL` | No                       | _(unset → no webhook)_ | HTTPS URL to POST alerts to (Slack/Discord/Sentry-compatible) |
| `ABUSE_ALERT_THRESHOLD`   | No                       | `5`                    | Incidents per identifier per hour before alerting             |
| `ABUSE_ALERT_COOLDOWN_S`  | No                       | `3600`                 | Min seconds between alerts for the same identifier            |
| `ABUSE_ADMIN_TOKEN`       | Yes (for `/admin/abuse`) | _(auto-generated)_     | Bearer-style token gating the admin page                      |

### What happens when a secret is missing

- **`ABUSE_ALERT_WEBHOOK_URL` missing or not `https://…`** — `maybeAlert()`
  short-circuits silently. The server logs one info-level line on first call
  (`webhook alerts disabled`). Rate limiting, logging, and event persistence
  still work.
- **`ABUSE_ALERT_THRESHOLD` / `ABUSE_ALERT_COOLDOWN_S` missing** — defaults
  apply. Non-numeric values fall back to the defaults via `Number()` + `??`.
- **`ABUSE_ADMIN_TOKEN` missing** — `/admin/abuse` returns
  `"ABUSE_ADMIN_TOKEN not configured on the server."` for every load attempt.

## Webhook reliability

`maybeAlert()` calls `postWebhookWithRetry()`:

- 3 attempts by default, exponential backoff (`250ms → 500ms → 1000ms`)
  with jitter.
- 4 second per-attempt timeout via `AbortController`.
- Retries `5xx`, `408`, `429`. Does **not** retry other `4xx` (your
  webhook said "no" — don't keep trying).
- Never throws — failures only log. **Rate limiting always continues
  to work**, even if the webhook endpoint is down or wrong.

## Admin debugging page

`/admin/abuse` shows the last 200 events (timestamp, reason, identifier,
endpoint, count / limit, window). It's gated by `ABUSE_ADMIN_TOKEN`:
paste the token into the page (stored in `sessionStorage` for the tab).
The route is `ssr: false` and `<meta name="robots" content="noindex">`.

## Tests

- `src/lib/__tests__/abuse-alert.test.ts` — threshold gating, per-identifier
  cooldown, retry/backoff, safe failure when the webhook is down or misconfigured.
- `src/lib/__tests__/anon-postgrest.integration.test.ts` — verifies anon
  PostgREST returns only `user_id IS NULL` rows from `bills` and an empty set
  from `device_watchlist`. Auto-skipped when Supabase env vars aren't set.
