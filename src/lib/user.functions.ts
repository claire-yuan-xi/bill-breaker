import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bumpRateLimit, clientIpFromRequest } from "@/lib/rate-limit.server";

const STATE_RE = /^[A-Z]{2}$/;
const BILL_NO_RE = /^[A-Za-z]{1,8}[.\s-]?\d{1,6}$/;

const ProfileSchema = z.object({
  display_name: z.string().trim().max(80).nullable().optional(),
  home_state: z.string().regex(STATE_RE).nullable().optional(),
  income_band: z
    .enum(["under_30k", "30k_75k", "75k_150k", "150k_300k", "over_300k"])
    .nullable()
    .optional(),
  family_status: z.enum(["single", "couple", "parent", "retired"]).nullable().optional(),
  job_sector: z
    .enum(["private", "public", "self_employed", "student", "unemployed", "retired", "other"])
    .nullable()
    .optional(),
});

export type Profile = z.infer<typeof ProfileSchema> & { user_id: string };

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return (data || null) as Profile | null;
  });

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const WatchInput = z.object({
  state: z.string().regex(STATE_RE),
  bill_no: z.string().regex(BILL_NO_RE),
  title: z.string().trim().max(300).nullable().optional(),
});

export const addWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WatchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("watchlist")
      .upsert(
        { user_id: userId, state: data.state, bill_no: data.bill_no, title: data.title ?? null },
        { onConflict: "user_id,state,bill_no" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ state: z.string().regex(STATE_RE), bill_no: z.string().regex(BILL_NO_RE) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", userId)
      .eq("state", data.state)
      .eq("bill_no", data.bill_no);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("watchlist")
      .select("state, bill_no, title, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data || []) as {
      state: string;
      bill_no: string;
      title: string | null;
      created_at: string;
    }[];
  });

export const isWatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ state: z.string().regex(STATE_RE), bill_no: z.string().regex(BILL_NO_RE) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", userId)
      .eq("state", data.state)
      .eq("bill_no", data.bill_no)
      .maybeSingle();
    return { watching: !!row };
  });

// === Shared snapshots ===

const MAX_SHARE_PAYLOAD_BYTES = 200_000;

const ShareInput = z.object({
  state: z.string().regex(STATE_RE),
  bill_no: z.string().regex(BILL_NO_RE).or(z.literal("")),
  title: z.string().trim().max(300).nullable().optional(),
  source_url: z.string().url().max(2000).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
    let serialized: string;
    try {
      serialized = JSON.stringify(val);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Payload is not serializable." });
      return;
    }
    if (serialized.length > MAX_SHARE_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payload too large (max ${MAX_SHARE_PAYLOAD_BYTES} bytes).`,
      });
    }
  }),
});

function randomSlug(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export const createShare = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ShareInput.parse(input))
  .handler(async ({ data }) => {
    // Anonymous publish — no sign-in required. IP-throttled to keep abuse down.
    // Structured `[abuse]` log lines are also emitted by bumpRateLimit.
    try {
      const ip = clientIpFromRequest(getRequest());
      const minute = await bumpRateLimit(`ip:${ip}:publish:1m`, 5, 60);
      if (!minute.allowed) {
        console.warn(
          `[abuse] publish minute-limit hit ip=${ip} state=${data.state} bill=${data.bill_no}`,
        );
        throw new Error("Too many publishes from this IP. Wait a minute and try again.");
      }
      const hour = await bumpRateLimit(`ip:${ip}:publish:1h`, 30, 3600);
      if (!hour.allowed) {
        console.warn(
          `[abuse] publish hour-limit hit ip=${ip} state=${data.state} bill=${data.bill_no}`,
        );
        throw new Error("Hourly publish limit reached. Try again later.");
      }
    } catch (e) {
      // Re-throw rate limit errors; swallow getRequest failures (e.g. in tests).
      if (e instanceof Error && /limit/i.test(e.message)) throw e;
    }

    for (let i = 0; i < 5; i++) {
      const slug = randomSlug(8);
      const { error } = await supabaseAdmin.from("shared_analyses").insert({
        slug,
        author_id: null,
        state: data.state,
        bill_no: data.bill_no,
        title: data.title ?? null,
        source_url: data.source_url ?? null,
        payload: data.payload as never,
      });
      if (!error) return { slug };
      if (
        !String(error.message || "")
          .toLowerCase()
          .includes("duplicate")
      ) {
        throw new Error(error.message);
      }
    }
    throw new Error("Could not generate share link, try again.");
  });

export const getShare = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().regex(/^[a-z0-9]{4,16}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("shared_analyses")
      .select("slug, state, bill_no, title, source_url, payload, created_at")
      .eq("slug", data.slug)
      .maybeSingle();
    return row;
  });
