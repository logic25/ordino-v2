
-- Add category_ratings JSONB column to store per-category ratings like {"responsiveness": 4, "fair_price": 5}
ALTER TABLE public.company_reviews ADD COLUMN category_ratings jsonb DEFAULT '{}'::jsonb;
