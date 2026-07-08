ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS third_party_review_allowed text NOT NULL DEFAULT 'unknown'
    CHECK (third_party_review_allowed IN ('yes','no','unknown')),
  ADD COLUMN IF NOT EXISTS third_party_review_notes text,
  ADD COLUMN IF NOT EXISTS third_party_review_source_url text;