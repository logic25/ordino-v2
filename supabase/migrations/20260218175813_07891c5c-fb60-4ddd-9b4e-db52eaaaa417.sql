
-- Create checklist_followup_drafts table
CREATE TABLE public.checklist_followup_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  draft_body text NOT NULL,
  prompt_system text,
  prompt_user text,
  status text NOT NULL DEFAULT 'pending_approval',
  triggered_by text NOT NULL DEFAULT 'auto',
  trigger_threshold_days integer,
  items_snapshot jsonb,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_followup_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view drafts"
  ON public.checklist_followup_drafts FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert drafts"
  ON public.checklist_followup_drafts FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update drafts"
  ON public.checklist_followup_drafts FOR UPDATE
  USING (public.is_company_member(company_id));

-- Index for common queries
CREATE INDEX idx_checklist_followup_drafts_project ON public.checklist_followup_drafts(project_id, status);
CREATE INDEX idx_checklist_followup_drafts_company ON public.checklist_followup_drafts(company_id, status);
