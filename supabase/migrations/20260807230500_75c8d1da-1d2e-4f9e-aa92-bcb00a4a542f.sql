-- ============================================================
-- rfp-partner-response token hardening
--
-- The partner-response link (edge function `rfp-partner-response`) mutates
-- state from a plain GET, using a token that never expired, was never
-- invalidated after use, and had no rate limit. This migration adds the
-- expiry column the function needs and closes an over-broad RLS policy.
-- ============================================================

-- 1. Token expiry ------------------------------------------------------------
-- New tokens expire 30 days after the row is created; existing tokens are
-- backfilled to 30 days after the outreach was notified.
ALTER TABLE public.rfp_partner_outreach
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days');

UPDATE public.rfp_partner_outreach
  SET token_expires_at = notified_at + INTERVAL '30 days'
  WHERE token_expires_at IS NULL
     OR token_expires_at = (now() + INTERVAL '30 days');

-- 2. Drop the over-broad public UPDATE policy --------------------------------
-- "Anyone can update via response token" allowed ANY anon caller to UPDATE ANY
-- outreach row (USING true / WITH CHECK true) straight through PostgREST —
-- not just the intended edge-function path. The edge function uses the
-- service-role key and bypasses RLS, so it does not rely on this policy; and
-- authenticated GLE staff are already covered by the company-member policies.
-- Removing it eliminates a cross-tenant tamper surface.
DROP POLICY IF EXISTS "Anyone can update via response token" ON public.rfp_partner_outreach;
