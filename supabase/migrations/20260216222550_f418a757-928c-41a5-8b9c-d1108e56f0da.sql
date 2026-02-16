
-- ============================================================
-- Part A: New columns on projects table
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS expected_construction_start date,
  ADD COLUMN IF NOT EXISTS estimated_construction_completion date,
  ADD COLUMN IF NOT EXISTS actual_construction_start date,
  ADD COLUMN IF NOT EXISTS actual_construction_completion date,
  ADD COLUMN IF NOT EXISTS project_complexity_tier varchar(20),
  ADD COLUMN IF NOT EXISTS gc_company_name text,
  ADD COLUMN IF NOT EXISTS gc_contact_name text,
  ADD COLUMN IF NOT EXISTS gc_phone text,
  ADD COLUMN IF NOT EXISTS gc_email text,
  ADD COLUMN IF NOT EXISTS architect_company_name text,
  ADD COLUMN IF NOT EXISTS architect_contact_name text,
  ADD COLUMN IF NOT EXISTS architect_phone text,
  ADD COLUMN IF NOT EXISTS architect_email text;

-- ============================================================
-- Part B: Notifications table
-- ============================================================
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- Part C: PIS Tracking table
-- ============================================================
CREATE TABLE public.pis_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rfi_request_id uuid REFERENCES public.rfi_requests(id) ON DELETE SET NULL,
  field_id text NOT NULL,
  field_label text NOT NULL,
  first_requested_at timestamptz NOT NULL DEFAULT now(),
  last_reminded_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  fulfilled_at timestamptz,
  fulfilled_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pis_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pis_tracking in their company"
  ON public.pis_tracking FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert pis_tracking in their company"
  ON public.pis_tracking FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update pis_tracking in their company"
  ON public.pis_tracking FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_pis_tracking_project ON public.pis_tracking (project_id);
CREATE INDEX idx_pis_tracking_unfulfilled ON public.pis_tracking (project_id)
  WHERE fulfilled_at IS NULL;
