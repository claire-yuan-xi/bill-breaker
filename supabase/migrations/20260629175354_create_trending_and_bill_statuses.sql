-- Trending bills cache (refreshed hourly by pg_cron)
CREATE TABLE public.trending_bills (
  state text NOT NULL,
  bill_no text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  rank int NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (state, bill_no)
);
GRANT SELECT ON public.trending_bills TO anon, authenticated;
GRANT ALL ON public.trending_bills TO service_role;
ALTER TABLE public.trending_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trending" ON public.trending_bills FOR SELECT TO anon, authenticated USING (true);

-- Bill status cache (re-checked daily)
CREATE TABLE public.bill_statuses (
  state text NOT NULL,
  bill_no text NOT NULL,
  status text,
  last_action text,
  last_action_date timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (state, bill_no)
);
GRANT SELECT ON public.bill_statuses TO anon, authenticated;
GRANT ALL ON public.bill_statuses TO service_role;
ALTER TABLE public.bill_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read statuses" ON public.bill_statuses FOR SELECT TO anon, authenticated USING (true);

-- Retention cleanup function: prunes old rows per documented windows.
CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_analyses int := 0;
  v_abuse int := 0;
  v_rate int := 0;
  v_shared int := 0;
BEGIN
  DELETE FROM public.bill_analyses WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_bill_analyses = ROW_COUNT;

  DELETE FROM public.abuse_events WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_abuse = ROW_COUNT;

  DELETE FROM public.rate_limits WHERE window_end < now() - interval '1 hour';
  GET DIAGNOSTICS v_rate = ROW_COUNT;

  -- shared analyses with no views in 90d
  DELETE FROM public.shared_analyses WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_shared = ROW_COUNT;

  RETURN jsonb_build_object(
    'bill_analyses', v_bill_analyses,
    'abuse_events', v_abuse,
    'rate_limits', v_rate,
    'shared_analyses', v_shared,
    'ran_at', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_retention_cleanup() TO service_role;