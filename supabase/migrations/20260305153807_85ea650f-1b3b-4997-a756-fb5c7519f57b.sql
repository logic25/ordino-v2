
-- Fix the notify_bug_report_activity trigger: use correct column names
CREATE OR REPLACE FUNCTION public.notify_bug_report_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.notifications (company_id, user_id, type, title, body, link)
      VALUES (
        NEW.company_id,
        profile_row.id,
        'bug_reported',
        'New Bug: ' || NEW.title,
        LEFT(NEW.description, 200),
        '/help'
      );
    END LOOP;
  END IF;

  -- On UPDATE: if status changed to resolved, notify the original reporter
  IF TG_OP = 'UPDATE' AND NEW.category = 'bug_report'
     AND NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
    INSERT INTO public.notifications (company_id, user_id, type, title, body, link)
    VALUES (
      NEW.company_id,
      NEW.user_id,
      'bug_reported',
      'Bug Resolved: ' || NEW.title,
      COALESCE(NEW.admin_notes, 'Your reported bug has been resolved.'),
      '/help'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_bug_report_activity ON public.feature_requests;
CREATE TRIGGER on_bug_report_activity
  AFTER INSERT OR UPDATE ON public.feature_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_bug_report_activity();

-- Add attachments and loom_url columns
ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS loom_url text;

-- Create bug-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-attachments', 'bug-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for bug-attachments bucket
CREATE POLICY "Company members can upload bug attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bug-attachments');

CREATE POLICY "Anyone can view bug attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bug-attachments');

CREATE POLICY "Company members can delete bug attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bug-attachments');
