
-- 1) Cache table for AI analyses keyed by (state, bill_no, text_hash)
CREATE TABLE public.bill_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  title TEXT,
  source_url TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE (state, bill_no, text_hash)
);

CREATE INDEX bill_analyses_lookup_idx ON public.bill_analyses (state, bill_no, text_hash);
CREATE INDEX bill_analyses_expiry_idx ON public.bill_analyses (expires_at);

GRANT SELECT ON public.bill_analyses TO anon, authenticated;
GRANT ALL ON public.bill_analyses TO service_role;

ALTER TABLE public.bill_analyses ENABLE ROW LEVEL SECURITY;

-- Cached analyses are derived from public bill text — readable by anyone.
CREATE POLICY "bill_analyses readable by all"
ON public.bill_analyses FOR SELECT
USING (true);

-- 2) Watchlist status tracking
ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS last_status TEXT,
  ADD COLUMN IF NOT EXISTS last_action TEXT,
  ADD COLUMN IF NOT EXISTS last_action_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Allow authenticated users to UPDATE their own watchlist rows
-- (current policy set has no UPDATE — needed for marking change as seen)
CREATE POLICY "own watchlist update"
ON public.watchlist FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
