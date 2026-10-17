REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_retention_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_retention_cleanup() TO service_role;