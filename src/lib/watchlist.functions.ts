// Anonymous device-keyed watchlist sync. No auth — security comes from the
// opacity of the device_id (UUID v4 held only in the user's localStorage)
// and per-IP rate limiting on writes.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { bumpRateLimit, clientIpFromRequest } from "@/lib/rate-limit.server";

const DeviceId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const State = z.string().regex(/^[A-Z]{2,4}$/);
const BillNo = z
  .string()
  .regex(/^[A-Za-z]{1,8}[.\s-]?\d{1,6}$/)
  .max(20);
const Title = z.string().max(400).default("");

/** Cloud sync needs the Supabase service keys; without them the list stays on this device. */
export function cloudSyncConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const NOT_SET_UP = "Cloud sync isn't set up yet.";

export type RemoteItem = { state: string; bill_no: string; title: string; added_at: string };

const PullArgs = z.object({ device_id: DeviceId });
const PushArgs = z.object({ device_id: DeviceId, state: State, bill_no: BillNo, title: Title });
const RemoveArgs = z.object({ device_id: DeviceId, state: State, bill_no: BillNo });

/** Exported for tests — pure DB scope, no rate-limiting, no request context. */
export async function _pullDeviceWatchlistImpl(data: {
  device_id: string;
}): Promise<{ items: RemoteItem[] }> {
  const args = PullArgs.parse(data);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("device_watchlist")
    .select("state, bill_no, title, added_at")
    .eq("device_id", args.device_id.toLowerCase())
    .order("added_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[watchlist] pull error:", error.message);
    return { items: [] };
  }
  return { items: (rows ?? []) as RemoteItem[] };
}

async function ipThrottle(scope: string) {
  const req = getRequest();
  const ip = clientIpFromRequest(req);
  const minute = await bumpRateLimit(`ip:${ip}:wl:${scope}:1m`, 30, 60);
  if (!minute.allowed) throw new Error("Too many requests, slow down.");
  const hour = await bumpRateLimit(`ip:${ip}:wl:${scope}:1h`, 400, 3600);
  if (!hour.allowed) throw new Error("Hourly sync limit reached.");
}

/** Exported for tests. Validates + writes one row scoped to the caller's device id. */
export async function _pushDeviceWatchlistItemImpl(data: {
  device_id: string;
  state: string;
  bill_no: string;
  title: string;
}): Promise<{ ok: true }> {
  const args = PushArgs.parse(data);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("device_watchlist").upsert(
    {
      device_id: args.device_id.toLowerCase(),
      state: args.state.toUpperCase(),
      bill_no: args.bill_no.toUpperCase(),
      title: args.title.slice(0, 400),
      added_at: new Date().toISOString(),
    },
    { onConflict: "device_id,state,bill_no" },
  );
  if (error) {
    console.error("[watchlist] push error:", error.message);
    throw new Error("Sync failed.");
  }
  return { ok: true };
}

/** Exported for tests. Validates + deletes one row scoped to the caller's device id. */
export async function _removeDeviceWatchlistItemImpl(data: {
  device_id: string;
  state: string;
  bill_no: string;
}): Promise<{ ok: true }> {
  const args = RemoveArgs.parse(data);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("device_watchlist")
    .delete()
    .eq("device_id", args.device_id.toLowerCase())
    .eq("state", args.state.toUpperCase())
    .eq("bill_no", args.bill_no.toUpperCase());
  if (error) {
    console.error("[watchlist] remove error:", error.message);
    throw new Error("Sync failed.");
  }
  return { ok: true };
}

export const getWatchlistSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ cloud: boolean }> => ({ cloud: cloudSyncConfigured() }),
);

export const pullDeviceWatchlist = createServerFn({ method: "POST" })
  .inputValidator((data: { device_id: string }) => PullArgs.parse(data))
  .handler(async ({ data }) => {
    if (!cloudSyncConfigured()) return { items: [] as RemoteItem[] };
    return _pullDeviceWatchlistImpl(data);
  });

export const pushDeviceWatchlistItem = createServerFn({ method: "POST" })
  .inputValidator((data: { device_id: string; state: string; bill_no: string; title: string }) =>
    PushArgs.parse(data),
  )
  .handler(async ({ data }) => {
    if (!cloudSyncConfigured()) throw new Error(NOT_SET_UP);
    await ipThrottle("push");
    return _pushDeviceWatchlistItemImpl(data);
  });

export const removeDeviceWatchlistItem = createServerFn({ method: "POST" })
  .inputValidator((data: { device_id: string; state: string; bill_no: string }) =>
    RemoveArgs.parse(data),
  )
  .handler(async ({ data }) => {
    if (!cloudSyncConfigured()) throw new Error(NOT_SET_UP);
    await ipThrottle("remove");
    return _removeDeviceWatchlistItemImpl(data);
  });

export const bulkPushDeviceWatchlist = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      device_id: string;
      items: Array<{ state: string; bill_no: string; title: string; ts: number }>;
    }) =>
      z
        .object({
          device_id: DeviceId,
          items: z
            .array(
              z.object({
                state: State,
                bill_no: BillNo,
                title: Title,
                ts: z.number().int().nonnegative(),
              }),
            )
            .max(200),
        })
        .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; count: number }> => {
    if (!cloudSyncConfigured()) throw new Error(NOT_SET_UP);
    await ipThrottle("bulk");
    if (data.items.length === 0) return { ok: true, count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.items.map((i) => ({
      device_id: data.device_id.toLowerCase(),
      state: i.state.toUpperCase(),
      bill_no: i.bill_no.toUpperCase(),
      title: i.title.slice(0, 400),
      added_at: new Date(i.ts || Date.now()).toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("device_watchlist")
      .upsert(rows, { onConflict: "device_id,state,bill_no" });
    if (error) {
      console.error("[watchlist] bulk push error:", error.message);
      throw new Error("Sync failed.");
    }
    return { ok: true, count: rows.length };
  });
