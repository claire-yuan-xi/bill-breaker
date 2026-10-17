import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchTrendingBills, searchBillsByKeyword, type TrendingBill } from "./congress.server";

export type { TrendingBill };

// Reads from the trending_bills cache (refreshed hourly by pg_cron).
// Falls back to live RSS if the cache is empty (e.g. before first cron run).
export const getTrendingBills = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: TrendingBill[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("trending_bills")
      .select("state,bill_no,title,url")
      .order("rank", { ascending: true })
      .limit(12);
    if (!error && data && data.length > 0) {
      return {
        items: data.map((r) => ({
          state: "US" as const,
          bill_no: r.bill_no,
          title: r.title,
          url: r.url,
        })),
      };
    }
    const items = await fetchTrendingBills();
    return { items };
  },
);

export const searchBills = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().trim().min(2).max(100) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ items: TrendingBill[] }> => {
    const items = await searchBillsByKeyword(data.q);
    return { items };
  });
