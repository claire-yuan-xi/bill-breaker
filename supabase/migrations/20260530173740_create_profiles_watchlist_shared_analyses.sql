-- 1) Profiles
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  home_state TEXT CHECK (home_state IS NULL OR home_state ~ '^[A-Z]{2}$'),
  income_band TEXT CHECK (income_band IN ('under_30k','30k_75k','75k_150k','150k_300k','over_300k')),
  family_status TEXT CHECK (family_status IN ('single','couple','parent','retired')),
  job_sector TEXT CHECK (job_sector IN ('private','public','self_employed','student','unemployed','retired','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile delete" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) Watchlist
CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  bill_no TEXT NOT NULL CHECK (length(bill_no) BETWEEN 1 AND 40),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, state, bill_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own watchlist select" ON public.watchlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own watchlist insert" ON public.watchlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own watchlist delete" ON public.watchlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX watchlist_user_idx ON public.watchlist(user_id, created_at DESC);

-- 3) Shared analyses (opt-in snapshots)
CREATE TABLE public.shared_analyses (
  slug TEXT PRIMARY KEY,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  state TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  title TEXT,
  source_url TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shared_analyses TO anon;
GRANT SELECT, INSERT, DELETE ON public.shared_analyses TO authenticated;
GRANT ALL ON public.shared_analyses TO service_role;

ALTER TABLE public.shared_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read shared" ON public.shared_analyses
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "author insert shared" ON public.shared_analyses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author delete shared" ON public.shared_analyses
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE INDEX shared_analyses_created_idx ON public.shared_analyses(created_at DESC);