
CREATE OR REPLACE FUNCTION public.global_search(_q text, _limit int DEFAULT 8)
RETURNS TABLE (kind text, id uuid, title text, subtitle text, url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company uuid;
  _pattern text;
BEGIN
  SELECT company_id INTO _company FROM public.profiles
  WHERE user_id = auth.uid() LIMIT 1;

  IF _company IS NULL OR _q IS NULL OR length(trim(_q)) < 2 THEN
    RETURN;
  END IF;
  _pattern := '%' || trim(_q) || '%';

  RETURN QUERY
  (
    SELECT 'lead'::text, l.id,
           l.full_name::text AS title,
           COALESCE(l.company, l.contact_email, l.contact_phone)::text AS subtitle,
           ('/bd/leads/' || l.id::text) AS url
    FROM public.leads l
    WHERE l.company_id = _company
      AND l.deleted_at IS NULL
      AND (l.full_name ILIKE _pattern
        OR l.company ILIKE _pattern
        OR l.contact_email ILIKE _pattern
        OR l.contact_phone ILIKE _pattern)
    ORDER BY l.updated_at DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'proposal'::text, p.id,
           COALESCE(NULLIF(p.proposal_number, ''), p.title, 'Proposal')::text AS title,
           COALESCE(p.client_name, p.status)::text AS subtitle,
           ('/proposals?proposal=' || p.id::text) AS url
    FROM public.proposals p
    WHERE p.company_id = _company
      AND (p.proposal_number ILIKE _pattern
        OR p.title ILIKE _pattern
        OR p.client_name ILIKE _pattern)
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'client'::text, c.id, c.name::text AS title,
           COALESCE(c.email, c.phone)::text AS subtitle,
           ('/clients?client=' || c.id::text) AS url
    FROM public.clients c
    WHERE c.company_id = _company
      AND (c.name ILIKE _pattern OR c.email ILIKE _pattern OR c.phone ILIKE _pattern)
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'project'::text, pr.id,
           COALESCE(NULLIF(pr.project_number, ''), pr.name, 'Project')::text AS title,
           COALESCE(pp.address, pr.status)::text AS subtitle,
           ('/projects/' || pr.id::text) AS url
    FROM public.projects pr
    LEFT JOIN public.properties pp ON pp.id = pr.property_id
    WHERE pr.company_id = _company
      AND (pr.project_number ILIKE _pattern
        OR pr.name ILIKE _pattern
        OR pp.address ILIKE _pattern)
    ORDER BY pr.updated_at DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'property'::text, pp.id, pp.address::text AS title,
           COALESCE(pp.borough, pp.bin)::text AS subtitle,
           ('/properties/' || pp.id::text) AS url
    FROM public.properties pp
    WHERE pp.company_id = _company
      AND (pp.address ILIKE _pattern OR pp.bin ILIKE _pattern OR pp.block ILIKE _pattern OR pp.lot ILIKE _pattern)
    ORDER BY pp.updated_at DESC NULLS LAST
    LIMIT _limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_search(text, int) TO authenticated;
