
-- Fix claimflow_referrals RLS policies to use correct auth check
DROP POLICY IF EXISTS "Users can create claimflow referrals for their company" ON public.claimflow_referrals;
DROP POLICY IF EXISTS "Users can update claimflow referrals for their company" ON public.claimflow_referrals;
DROP POLICY IF EXISTS "Users can view claimflow referrals for their company" ON public.claimflow_referrals;

CREATE POLICY "Users can create claimflow referrals for their company"
ON public.claimflow_referrals FOR INSERT
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can update claimflow referrals for their company"
ON public.claimflow_referrals FOR UPDATE
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can view claimflow referrals for their company"
ON public.claimflow_referrals FOR SELECT
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));
