// Integration test: hits the real Supabase Data API with the public anon key
// to verify the RLS policies for `bills.bill_text` and `device_watchlist`.
//
// This test is SKIPPED automatically when SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY
// aren't available (e.g. local CI without secrets). When run, it makes
// read-only network calls — no writes.

import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const d = url && anonKey ? describe : describe.skip;

d("anon PostgREST policy enforcement", () => {
  const supabase = createClient(url!, anonKey!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  it("bills: anon SELECT only returns rows where user_id IS NULL", async () => {
    const { data, error } = await supabase.from("bills").select("id, user_id, bill_text").limit(50);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect((row as { user_id: string | null }).user_id).toBeNull();
    }
  });

  it("bills: anon cannot read rows by filtering on a non-null user_id", async () => {
    const { data, error } = await supabase
      .from("bills")
      .select("id, user_id")
      .not("user_id", "is", null)
      .limit(10);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("device_watchlist: anon SELECT returns no rows regardless of device_id filter", async () => {
    const guess = "00000000-0000-4000-8000-000000000000";
    const { data, error } = await supabase
      .from("device_watchlist")
      .select("device_id, state, bill_no")
      .eq("device_id", guess)
      .limit(10);
    // USING (false) returns an empty set, not an error.
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("device_watchlist: anon SELECT with no filter is also empty", async () => {
    const { data, error } = await supabase.from("device_watchlist").select("device_id").limit(10);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});
