REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;