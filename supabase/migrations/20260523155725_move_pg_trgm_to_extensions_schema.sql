
DROP INDEX IF EXISTS public.idx_bills_title_trgm;
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
CREATE INDEX idx_bills_title_trgm ON public.bills USING GIN (title extensions.gin_trgm_ops);
