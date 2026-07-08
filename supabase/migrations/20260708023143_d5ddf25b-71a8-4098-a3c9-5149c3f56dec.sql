
-- Fix is_gle_staff: never treat NULL portal_role as staff
CREATE OR REPLACE FUNCTION public.is_gle_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND portal_role = 'gle_staff'
  );
$$;

-- Set search_path on remaining public functions
ALTER FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(queue_name text, payload jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) SET search_path = public;
ALTER FUNCTION public.delete_email(queue_name text, message_id bigint) SET search_path = public;
ALTER FUNCTION public.portal_touch_updated_at() SET search_path = public;
