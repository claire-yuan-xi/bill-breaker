
-- Restrict anonymous reads of bills to non-user-submitted rows.
-- User-submitted bills (user_id IS NOT NULL) must only be visible to their owner.
DROP POLICY IF EXISTS "bills are publicly readable" ON public.bills;

CREATE POLICY "anon can read non-user bills"
  ON public.bills FOR SELECT
  TO anon
  USING (user_id IS NULL);

CREATE POLICY "authenticated can read public and own bills"
  ON public.bills FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- device_watchlist: add safe anon/authenticated RLS policies so direct
-- PostgREST access from the browser returns an empty result set instead of
-- a permission-denied error. All real reads/writes still flow through
-- server functions using the service role (which bypasses RLS).
GRANT SELECT ON public.device_watchlist TO anon, authenticated;

CREATE POLICY "deny anon direct select"
  ON public.device_watchlist FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "deny authenticated direct select"
  ON public.device_watchlist FOR SELECT
  TO authenticated
  USING (false);
