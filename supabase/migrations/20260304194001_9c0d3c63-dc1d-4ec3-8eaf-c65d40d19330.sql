
CREATE OR REPLACE FUNCTION public.merge_clients(
  primary_id uuid,
  duplicate_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  dup_id uuid;
BEGIN
  FOREACH dup_id IN ARRAY duplicate_ids LOOP
    -- Reassign all FK references from duplicate to primary
    UPDATE public.client_contacts SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.proposals SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.projects SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.projects SET building_owner_id = primary_id WHERE building_owner_id = dup_id;
    UPDATE public.invoices SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.calendar_events SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.change_orders SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.ach_authorizations SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.automation_logs SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.client_billing_rules SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.client_reviews SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.dob_applications SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.emails SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.leads SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.payment_plans SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.payment_promises SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.properties SET client_id = primary_id WHERE client_id = dup_id;
    UPDATE public.rfp_responses SET partner_client_id = primary_id WHERE partner_client_id = dup_id;
    UPDATE public.services SET client_id = primary_id WHERE client_id = dup_id;

    -- Delete the duplicate
    DELETE FROM public.clients WHERE id = dup_id;
  END LOOP;
END;
$$;
