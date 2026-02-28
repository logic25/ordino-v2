
CREATE TABLE public.activity_edit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  edited_by UUID NOT NULL REFERENCES public.profiles(id),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edit logs for their company"
  ON public.activity_edit_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert edit logs for their company"
  ON public.activity_edit_logs FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
