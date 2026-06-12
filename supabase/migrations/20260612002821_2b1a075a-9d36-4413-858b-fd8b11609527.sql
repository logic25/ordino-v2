CREATE OR REPLACE FUNCTION public.expense_create_billing_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_br_id UUID;
  computed_billable NUMERIC;
BEGIN
  IF NEW.status = 'pending_billing'
     AND NEW.billing_request_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_billing')
  THEN
    -- Compute billable_amount inline; the stored generated column is not
    -- populated yet during a BEFORE trigger, so NEW.billable_amount is NULL here.
    computed_billable := round(
      COALESCE(NEW.amount, 0) * (1 + COALESCE(NEW.markup_pct, 0) / 100.0),
      2
    );

    INSERT INTO public.billing_requests (
      company_id, project_id, created_by, services, total_amount, status, billed_to_contact_id
    ) VALUES (
      NEW.company_id, NEW.project_id, NEW.created_by,
      jsonb_build_array(jsonb_build_object(
        'expense_id', NEW.id,
        'description', NEW.description,
        'vendor', NEW.vendor,
        'amount', NEW.amount,
        'markup_pct', NEW.markup_pct,
        'billable_amount', computed_billable
      )),
      computed_billable, 'pending', NEW.billed_to_contact_id
    ) RETURNING id INTO new_br_id;
    NEW.billing_request_id := new_br_id;
  END IF;
  RETURN NEW;
END;
$function$;