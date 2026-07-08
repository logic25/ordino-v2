ALTER TABLE public.markets
  DROP CONSTRAINT IF EXISTS markets_third_party_review_allowed_check;

UPDATE public.markets SET third_party_review_allowed = 'accepted' WHERE third_party_review_allowed = 'yes';
UPDATE public.markets SET third_party_review_allowed = 'not_offered' WHERE third_party_review_allowed = 'no';

ALTER TABLE public.markets
  ALTER COLUMN third_party_review_allowed SET DEFAULT 'unknown',
  ADD CONSTRAINT markets_third_party_review_allowed_check
    CHECK (third_party_review_allowed IN ('accepted','accepted_with_restrictions','not_offered','unknown'));