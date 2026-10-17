CREATE TABLE IF NOT EXISTS public.abuse_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  identifier TEXT NOT NULL,
  endpoint TEXT,
  reason TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL DEFAULT 0,
  window_seconds INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS abuse_events_ts_idx ON public.abuse_events (ts DESC);
CREATE INDEX IF NOT EXISTS abuse_events_identifier_idx ON public.abuse_events (identifier);

GRANT ALL ON public.abuse_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.abuse_events_id_seq TO service_role;

ALTER TABLE public.abuse_events ENABLE ROW LEVEL SECURITY;

-- Lock the table to service_role only; admin reads go through a server fn that uses supabaseAdmin.
CREATE POLICY "abuse_events deny anon" ON public.abuse_events
  FOR SELECT TO anon USING (false);
CREATE POLICY "abuse_events deny authenticated" ON public.abuse_events
  FOR SELECT TO authenticated USING (false);