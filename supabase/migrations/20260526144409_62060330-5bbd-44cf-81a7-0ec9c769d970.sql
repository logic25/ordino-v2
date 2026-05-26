-- Enum for who a project is waiting on
DO $$ BEGIN
  CREATE TYPE public.project_waiting_on AS ENUM ('us', 'client', 'agency', 'partner', 'none');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS waiting_on public.project_waiting_on NOT NULL DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS waiting_note text;

-- Auto-stamp waiting_since whenever waiting_on changes
CREATE OR REPLACE FUNCTION public.touch_project_waiting_since()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.waiting_on IS DISTINCT FROM OLD.waiting_on THEN
    NEW.waiting_since := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_waiting_since ON public.projects;
CREATE TRIGGER trg_projects_waiting_since
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.touch_project_waiting_since();

CREATE INDEX IF NOT EXISTS idx_projects_waiting_on ON public.projects(waiting_on);