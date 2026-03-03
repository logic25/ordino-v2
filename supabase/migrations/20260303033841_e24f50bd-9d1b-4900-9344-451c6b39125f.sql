
-- Add deposit tracking to services
ALTER TABLE public.services
ADD COLUMN deposit_amount numeric DEFAULT 0,
ADD COLUMN deposit_paid boolean DEFAULT false;

-- Update the CO trigger to also set deposit amounts
CREATE OR REPLACE FUNCTION public.create_services_from_approved_co()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  app_id uuid;
  dep_pct numeric;
  svc_amount numeric;
  dep_amount numeric;
BEGIN
  IF NEW.status != 'approved' OR (OLD.status IS NOT NULL AND OLD.status = 'approved') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.services WHERE change_order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO app_id
  FROM public.dob_applications
  WHERE project_id = NEW.project_id
  LIMIT 1;

  dep_pct := COALESCE(NEW.deposit_percentage, 0);

  IF NEW.line_items IS NOT NULL AND jsonb_array_length(NEW.line_items::jsonb) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.line_items::jsonb) LOOP
      svc_amount := COALESCE((item->>'amount')::numeric, 0);
      dep_amount := CASE WHEN dep_pct > 0 THEN ROUND(svc_amount * dep_pct / 100, 2) ELSE 0 END;
      
      INSERT INTO public.services (
        company_id, project_id, application_id,
        name, description, fixed_price, total_amount,
        billing_type, status, change_order_id,
        deposit_amount, deposit_paid
      ) VALUES (
        NEW.company_id, NEW.project_id, app_id,
        'CO#' || SUBSTRING(NEW.co_number FROM 4) || ' - ' || (item->>'name'),
        COALESCE(item->>'description', NEW.description),
        svc_amount, svc_amount,
        'fixed', 'not_started', NEW.id,
        dep_amount, COALESCE(NEW.deposit_paid_at IS NOT NULL, false)
      );
    END LOOP;
  ELSE
    dep_amount := CASE WHEN dep_pct > 0 THEN ROUND(NEW.amount * dep_pct / 100, 2) ELSE 0 END;
    
    INSERT INTO public.services (
      company_id, project_id, application_id,
      name, description, fixed_price, total_amount,
      billing_type, status, change_order_id,
      deposit_amount, deposit_paid
    ) VALUES (
      NEW.company_id, NEW.project_id, app_id,
      'CO#' || SUBSTRING(NEW.co_number FROM 4) || ' - ' || NEW.title,
      NEW.description,
      NEW.amount, NEW.amount,
      'fixed', 'not_started', NEW.id,
      dep_amount, COALESCE(NEW.deposit_paid_at IS NOT NULL, false)
    );
  END IF;

  RETURN NEW;
END;
$$;
