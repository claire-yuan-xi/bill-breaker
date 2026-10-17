
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN (
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','US'
  )),
  bill_number TEXT NOT NULL,
  title TEXT,
  bill_text TEXT,
  summary TEXT,
  impact_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  provisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bills_state_bill_number ON public.bills (state, bill_number);
CREATE INDEX idx_bills_user_id ON public.bills (user_id);
CREATE INDEX idx_bills_created_at ON public.bills (created_at DESC);
CREATE INDEX idx_bills_title_trgm ON public.bills USING GIN (title gin_trgm_ops);
CREATE INDEX idx_bills_text_search ON public.bills USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(bill_text,'')));

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills are publicly readable"
  ON public.bills FOR SELECT
  USING (true);

CREATE POLICY "authenticated users can insert their own bills"
  ON public.bills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update their own bills"
  ON public.bills FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete their own bills"
  ON public.bills FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bills_set_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
