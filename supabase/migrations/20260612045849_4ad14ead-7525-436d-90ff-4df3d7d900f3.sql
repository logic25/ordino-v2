
ALTER TABLE public.bd_sequence_enrollments
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS sending_started_at timestamptz;

UPDATE public.bd_sequence_enrollments
  SET next_send_at = COALESCE(next_send_at, now())
  WHERE status = 'ACTIVE' AND next_send_at IS NULL;

CREATE INDEX IF NOT EXISTS bd_seq_enroll_due_idx
  ON public.bd_sequence_enrollments (created_by, next_send_at)
  WHERE status = 'ACTIVE' AND sending_started_at IS NULL;

-- Atomic claim: one due enrollment for an owner. Returns 0 rows if nothing claimable.
CREATE OR REPLACE FUNCTION public.claim_bd_sequence_enrollment(_owner uuid)
RETURNS SETOF public.bd_sequence_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id
  FROM public.bd_sequence_enrollments
  WHERE created_by = _owner
    AND status = 'ACTIVE'
    AND sending_started_at IS NULL
    AND next_send_at IS NOT NULL
    AND next_send_at <= now()
  ORDER BY next_send_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF _id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE public.bd_sequence_enrollments
       SET sending_started_at = now(),
           updated_at = now()
     WHERE id = _id
       AND sending_started_at IS NULL
     RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bd_sequence_enrollment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_bd_sequence_enrollment(uuid) TO service_role;
