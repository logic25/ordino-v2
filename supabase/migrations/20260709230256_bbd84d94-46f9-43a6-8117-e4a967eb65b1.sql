
CREATE OR REPLACE FUNCTION public.notify_users_of_content_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT DISTINCT p.user_id
    FROM public.profiles p
    WHERE p.company_id = NEW.company_id
      AND p.user_id IS NOT NULL
      AND (
        p.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.role_permissions rp
          WHERE rp.company_id = NEW.company_id
            AND rp.role = p.role
            AND rp.resource = 'content'
            AND rp.enabled = true
            AND rp.can_list = true
        )
      )
  LOOP
    INSERT INTO public.notifications (user_id, company_id, type, title, body, link)
    VALUES (
      r.user_id,
      NEW.company_id,
      'content_candidate_new',
      'New content idea: ' || COALESCE(NEW.title, 'Untitled'),
      COALESCE(NEW.content_preview, NEW.reasoning, NULL),
      '/content'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_users_of_content_candidate ON public.content_candidates;
CREATE TRIGGER trg_notify_users_of_content_candidate
AFTER INSERT ON public.content_candidates
FOR EACH ROW
EXECUTE FUNCTION public.notify_users_of_content_candidate();
