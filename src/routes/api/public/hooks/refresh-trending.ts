// Hourly trending-bills refresh — invoked by pg_cron.
// Pulls Congress.gov RSS, then upserts public.trending_bills.
import { createFileRoute } from "@tanstack/react-router";
import { fetchTrendingBills } from "@/lib/congress.server";

export const Route = createFileRoute("/api/public/hooks/refresh-trending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const items = await fetchTrendingBills();
        if (items.length === 0) {
          console.warn("[refresh-trending] RSS returned no items; keeping prior cache");
          return new Response(JSON.stringify({ ok: true, refreshed: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rows = items.map((it, i) => ({
          state: it.state,
          bill_no: it.bill_no,
          title: it.title,
          url: it.url,
          rank: i + 1,
          refreshed_at: new Date().toISOString(),
        }));
        const { error } = await supabaseAdmin
          .from("trending_bills")
          .upsert(rows, { onConflict: "state,bill_no" });
        if (error) {
          console.error("[refresh-trending] upsert failed", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Drop stale rows not in current top list
        const keep = rows.map((r) => `${r.state}:${r.bill_no}`);
        const { data: existing } = await supabaseAdmin
          .from("trending_bills")
          .select("state,bill_no");
        const stale = (existing ?? []).filter((r) => !keep.includes(`${r.state}:${r.bill_no}`));
        if (stale.length) {
          for (const s of stale) {
            await supabaseAdmin
              .from("trending_bills")
              .delete()
              .eq("state", s.state)
              .eq("bill_no", s.bill_no);
          }
        }
        console.log(`[refresh-trending] upserted ${rows.length}, pruned ${stale.length}`);
        return new Response(JSON.stringify({ ok: true, refreshed: rows.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
