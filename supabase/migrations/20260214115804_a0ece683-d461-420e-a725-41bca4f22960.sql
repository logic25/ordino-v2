
ALTER TABLE public.employee_reviews
  ADD COLUMN IF NOT EXISTS raise_pct numeric DEFAULT NULL;

COMMENT ON COLUMN public.employee_reviews.raise_pct IS 'Raise percentage determined by review rating, can be overridden by admin';
