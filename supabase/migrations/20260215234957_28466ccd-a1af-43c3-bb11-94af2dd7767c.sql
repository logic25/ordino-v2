
-- Add follow-up tracking columns to proposals
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS follow_up_interval_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS next_follow_up_date date,
  ADD COLUMN IF NOT EXISTS follow_up_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_up_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_dismissed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approval_method text, -- 'digital_signature', 'physical_copy', 'client_agreement', 'email_confirmation'
  ADD COLUMN IF NOT EXISTS signed_document_url text,
  ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz;

-- Create proposal follow-up activity log
CREATE TABLE public.proposal_follow_ups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  action text NOT NULL, -- 'sent', 'called', 'emailed', 'dismissed', 'approved', 'uploaded_signed_copy', 'reminder_auto'
  notes text,
  performed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS policies for proposal_follow_ups
CREATE POLICY "Users can view follow-ups for their company"
  ON public.proposal_follow_ups FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert follow-ups for their company"
  ON public.proposal_follow_ups FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete follow-ups for their company"
  ON public.proposal_follow_ups FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Auto-set next_follow_up_date when a proposal is sent
CREATE OR REPLACE FUNCTION public.set_proposal_follow_up()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    NEW.next_follow_up_date := CURRENT_DATE + COALESCE(NEW.follow_up_interval_days, 7);
    NEW.follow_up_count := 0;
  END IF;
  -- Clear follow-up when accepted/rejected/signed
  IF NEW.status IN ('accepted', 'rejected', 'signed_internal', 'signed_client') THEN
    NEW.next_follow_up_date := NULL;
    NEW.follow_up_dismissed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_set_proposal_follow_up
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_proposal_follow_up();

-- Index for dashboard queries
CREATE INDEX idx_proposals_next_follow_up ON public.proposals(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL AND follow_up_dismissed_at IS NULL;
