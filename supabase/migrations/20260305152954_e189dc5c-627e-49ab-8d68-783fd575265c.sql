
-- Add management columns to feature_requests
ALTER TABLE public.feature_requests 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- RLS policy: admins can update any bug in their company
CREATE POLICY "Admins can update feature_requests in their company"
ON public.feature_requests
FOR UPDATE
TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));

-- Trigger function for in-app notifications on bug activity
CREATE OR REPLACE FUNCTION public.notify_bug_report_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_row RECORD;
BEGIN
  -- On INSERT: notify all active profiles in same company except reporter
  IF TG_OP = 'INSERT' AND NEW.category = 'bug_report' THEN
    FOR profile_row IN
      SELECT id FROM public.profiles
      WHERE company_id = NEW.company_id
        AND is_active = true
        AND id != NEW.user_id
    LOOP
      INSERT INTO public.notifications (company_id, user_id, type, title, message, link, metadata)
      VALUES (
        NEW.company_id,
        profile_row.id,
        'bug_reported',
        'New Bug: ' || NEW.title,
        LEFT(NEW.description, 200),
        '/help',
        jsonb_build_object('bug_id', NEW.id, 'priority', NEW.priority)
      );
    END LOOP;
  END IF;

  -- On UPDATE: if status changed to resolved, notify the original reporter
  IF TG_OP = 'UPDATE' AND NEW.category = 'bug_report'
     AND NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
    INSERT INTO public.notifications (company_id, user_id, type, title, message, link, metadata)
    VALUES (
      NEW.company_id,
      NEW.user_id,
      'bug_reported',
      'Bug Resolved: ' || NEW.title,
      COALESCE(NEW.admin_notes, 'Your reported bug has been resolved.'),
      '/help',
      jsonb_build_object('bug_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER on_bug_report_activity
  AFTER INSERT OR UPDATE ON public.feature_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_bug_report_activity();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_requests;
