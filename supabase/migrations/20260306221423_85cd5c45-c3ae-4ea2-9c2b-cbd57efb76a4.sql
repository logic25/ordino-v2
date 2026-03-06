CREATE OR REPLACE FUNCTION public.get_rfi_plan_filenames(_access_token text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT d.filename), '{}')
  FROM rfi_requests r
  JOIN universal_documents d
    ON d.category = 'Plans'
    AND (
      (r.proposal_id IS NOT NULL AND d.proposal_id = r.proposal_id)
      OR (r.project_id IS NOT NULL AND d.project_id = r.project_id)
      OR (r.property_id IS NOT NULL AND d.property_id = r.property_id)
    )
  WHERE r.access_token = _access_token::uuid
$$;