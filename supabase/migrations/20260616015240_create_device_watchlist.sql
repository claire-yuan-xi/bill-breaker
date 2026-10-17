
-- 1. device_watchlist table
CREATE TABLE public.device_watchlist (
  device_id text NOT NULL,
  state text NOT NULL,
  bill_no text NOT NULL,
  title text NOT NULL DEFAULT '',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, state, bill_no)
);

-- Access only via service_role (server functions use supabaseAdmin).
GRANT ALL ON public.device_watchlist TO service_role;

ALTER TABLE public.device_watchlist ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: all reads/writes flow through admin-only server fns.
CREATE POLICY "service role full access"
  ON public.device_watchlist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX device_watchlist_device_idx
  ON public.device_watchlist (device_id, added_at DESC);

-- 2. bills.source
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS source text;
