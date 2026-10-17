// Daily bill-status recheck — invoked by pg_cron.
// Re-fetches latest action for every bill in public.bill_statuses that
// hasn't been checked in the last 20 hours, plus any bill currently in
// the trending cache.
import { createFileRoute } from "@tanstack/react-router";
import { fetchUSBillStatus } from "@/lib/congress.server";

const MAX_PER_RUN = 40;

export const Route = createFileRoute("/api/public/hooks/recheck-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
        const { data: stale } = await supabaseAdmin
          .from("bill_statuses")
          .select("state,bill_no")
          .lt("checked_at", cutoff)
          .limit(MAX_PER_RUN);
        const { data: trending } = await supabaseAdmin
          .from("trending_bills")
          .select("state,bill_no");

        const seen = new Set<string>();
        const targets: Array<{ state: string; bill_no: string }> = [];
        for (const row of [...(stale ?? []), ...(trending ?? [])]) {
          const k = `${row.state}:${row.bill_no}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (row.state === "US") targets.push(row);
          if (targets.length >= MAX_PER_RUN) break;
        }

        let updated = 0;
        let failed = 0;
        for (const t of targets) {
          try {
            const status = await fetchUSBillStatus(t.bill_no);
            const { error } = await supabaseAdmin.from("bill_statuses").upsert(
              {
                state: t.state,
                bill_no: t.bill_no,
                status: status?.status ?? null,
                last_action: status?.lastAction ?? null,
                last_action_date: status?.lastActionDate ?? null,
                checked_at: new Date().toISOString(),
              },
              { onConflict: "state,bill_no" },
            );
            if (error) failed++;
            else updated++;
          } catch {
            failed++;
          }
        }
        console.log(`[recheck-status] updated=${updated} failed=${failed}`);
        return new Response(JSON.stringify({ ok: true, updated, failed, total: targets.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
