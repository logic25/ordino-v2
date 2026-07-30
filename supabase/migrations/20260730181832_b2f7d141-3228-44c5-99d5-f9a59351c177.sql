DROP POLICY IF EXISTS "Anyone can view published bd_cards" ON public.bd_cards;

CREATE OR REPLACE FUNCTION public.get_public_bd_card(_slug text)
RETURNS TABLE (
  fields jsonb,
  photo_url text,
  cover_url text,
  logo_cfg jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jsonb_strip_nulls(jsonb_build_object(
      'first', c.fields->>'first',
      'last', c.fields->>'last',
      'title', c.fields->>'title',
      'email', c.fields->>'email',
      'phone', c.fields->>'phone',
      'extension', c.fields->>'extension',
      'mobile', c.fields->>'mobile',
      'linkedin', c.fields->>'linkedin',
      'address', c.fields->>'address'
    )),
    c.photo_url,
    c.cover_url,
    c.logo_cfg
  FROM public.bd_cards c
  WHERE c.slug = _slug
    AND c.published = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_bd_card(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_bd_card(text) TO anon, authenticated;

SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'bd_cards'
ORDER BY cmd, policyname;