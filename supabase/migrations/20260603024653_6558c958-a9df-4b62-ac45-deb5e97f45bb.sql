ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_notes_project_service
  ON public.project_notes (project_id, service_id, created_at DESC);