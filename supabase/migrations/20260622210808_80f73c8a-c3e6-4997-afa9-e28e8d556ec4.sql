CREATE OR REPLACE FUNCTION public.get_my_gmail_signature()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.signature_html
  FROM public.gmail_connections gc
  JOIN public.profiles p ON p.id = gc.user_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_gmail_signature() TO authenticated;