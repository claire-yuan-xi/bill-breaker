CREATE TABLE public.rate_limits (
  identifier TEXT NOT NULL PRIMARY KEY,
  window_end TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated; only service_role bypasses RLS.

CREATE INDEX idx_rate_limits_window_end ON public.rate_limits(window_end);

-- Atomic increment helper. Returns the new count and the window end.
-- Resets the counter when the previous window has expired.
CREATE OR REPLACE FUNCTION public.bump_rate_limit(
  _identifier TEXT,
  _window_seconds INTEGER,
  _limit INTEGER
)
RETURNS TABLE (current_count INTEGER, window_end TIMESTAMPTZ, allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _new_end TIMESTAMPTZ := _now + make_interval(secs => _window_seconds);
  _row public.rate_limits%ROWTYPE;
BEGIN
  INSERT INTO public.rate_limits (identifier, window_end, count)
  VALUES (_identifier, _new_end, 1)
  ON CONFLICT (identifier) DO UPDATE
    SET count = CASE
                  WHEN public.rate_limits.window_end < _now THEN 1
                  ELSE public.rate_limits.count + 1
                END,
        window_end = CASE
                       WHEN public.rate_limits.window_end < _now THEN _new_end
                       ELSE public.rate_limits.window_end
                     END
  RETURNING * INTO _row;

  RETURN QUERY SELECT _row.count, _row.window_end, _row.count <= _limit;
END;
$$;