CREATE TABLE public.bd_event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.bd_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bd_event_tasks_event ON public.bd_event_tasks(event_id);
CREATE INDEX idx_bd_event_tasks_assignee ON public.bd_event_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_event_tasks TO authenticated;
GRANT ALL ON public.bd_event_tasks TO service_role;

ALTER TABLE public.bd_event_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage bd_event_tasks"
  ON public.bd_event_tasks FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER update_bd_event_tasks_updated_at
  BEFORE UPDATE ON public.bd_event_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();