// Admin-only server fn that returns recent abuse events for the debugging page.
// Gated by a static ABUSE_ADMIN_TOKEN env var so we don't depend on user auth
// (the rest of the app is anonymous-by-design).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Args = z.object({
  token: z.string().min(16).max(256),
  limit: z.number().int().min(1).max(500).default(100),
});

export type AbuseEvent = {
  id: number;
  ts: string;
  identifier: string;
  endpoint: string | null;
  reason: string;
  count: number;
  limit_value: number;
  window_seconds: number;
};

export const fetchAbuseEvents = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; limit?: number }) => Args.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; events: AbuseEvent[] } | { ok: false; error: string }> => {
      const expected = process.env.ABUSE_ADMIN_TOKEN;
      if (!expected) return { ok: false, error: "ABUSE_ADMIN_TOKEN not configured on the server." };
      // Constant-time compare to avoid timing-side-channel guesses.
      const a = new TextEncoder().encode(data.token);
      const b = new TextEncoder().encode(expected);
      if (a.length !== b.length) return { ok: false, error: "Invalid token." };
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      if (diff !== 0) return { ok: false, error: "Invalid token." };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("abuse_events")
        .select("id, ts, identifier, endpoint, reason, count, limit_value, window_seconds")
        .order("ts", { ascending: false })
        .limit(data.limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, events: (rows ?? []) as AbuseEvent[] };
    },
  );
