ALTER TABLE public.roadmap_items
  ADD COLUMN IF NOT EXISTS stress_test_result jsonb,
  ADD COLUMN IF NOT EXISTS stress_tested_at timestamptz;