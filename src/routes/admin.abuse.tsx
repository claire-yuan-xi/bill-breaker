import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { fetchAbuseEvents, type AbuseEvent } from "@/lib/abuse-events.functions";

export const Route = createFileRoute("/admin/abuse")({
  ssr: false,
  component: AdminAbusePage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Admin · Abuse Events</h1>
        <p className="mt-2 text-sm text-destructive">
          Failed to load: {error instanceof Error ? error.message : "Please try again."}
        </p>
        <button
          className="mt-3 rounded border px-3 py-1 text-sm"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Retry
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found.</div>,
  head: () => ({
    meta: [
      { title: "BillBreaker — Abuse monitoring" },
      {
        name: "description",
        content: "Review recent BillBreaker rate-limit events and abuse alerts.",
      },
      { property: "og:title", content: "BillBreaker — Abuse monitoring" },
      {
        property: "og:description",
        content: "BillBreaker rate-limit events and abuse monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const TOKEN_KEY = "abuse-admin-token";

function AdminAbusePage() {
  const call = useServerFn(fetchAbuseEvents);
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<AbuseEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(TOKEN_KEY);
      if (saved) setToken(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      try {
        window.sessionStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* ignore */
      }
      const res = await call({ data: { token, limit: 200 } });
      if ("ok" in res && res.ok) setEvents(res.events);
      else setError("error" in res ? res.error : "Unknown error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Abuse Events</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Recent rate-limit events (near limit, exceeded, RPC errors). Service-role only — gated by{" "}
        <code>ABUSE_ADMIN_TOKEN</code>.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ABUSE_ADMIN_TOKEN"
          className="flex-1 rounded border bg-background px-3 py-1.5 text-sm"
          autoComplete="off"
        />
        <button
          onClick={load}
          disabled={!token || loading}
          className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {events && (
        <div className="mt-6 overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Identifier</th>
                <th className="px-3 py-2">Endpoint</th>
                <th className="px-3 py-2 text-right">Count / Limit</th>
                <th className="px-3 py-2 text-right">Window</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No recent events.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{new Date(e.ts).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <ReasonBadge reason={e.reason} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{e.identifier}</td>
                  <td className="px-3 py-2 text-xs">{e.endpoint ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {e.count} / {e.limit_value}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{e.window_seconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const color =
    reason === "limit_exceeded"
      ? "bg-destructive/15 text-destructive"
      : reason === "near_limit"
        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{reason}</span>;
}
