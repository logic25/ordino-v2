-- BD Sprint 2 — add PLANNING to the lead timeline enum.
-- Isolated in its own migration: ALTER TYPE ... ADD VALUE cannot be used in the
-- same transaction that later references the new value. Placed before UNKNOWN so
-- the enum reads in a logical funnel order. The 6 UI options map as:
--   IMMEDIATE → "Immediate", MONTHS_1_3 → "1-3 months", MONTHS_3_6 → "3-6 months",
--   MONTHS_6_PLUS → "6-12 months", PLANNING → "Planning", UNKNOWN → "Unknown".
ALTER TYPE public.bd_lead_timeline ADD VALUE IF NOT EXISTS 'PLANNING' BEFORE 'UNKNOWN';
