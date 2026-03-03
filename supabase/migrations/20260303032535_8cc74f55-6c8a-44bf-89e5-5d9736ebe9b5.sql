
-- Add change_order_id column to services table
ALTER TABLE public.services
ADD COLUMN change_order_id uuid REFERENCES public.change_orders(id) ON DELETE SET NULL;

-- Create trigger function to auto-create services from approved COs
CREATE OR REPLACE FUNCTION public.create_services_from_approved_co()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  app_id uuid;
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

  IF NEW.line_items IS NOT NULL AND jsonb_array_length(NEW.line_items::jsonb) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.line_items::jsonb) LOOP
      INSERT INTO public.services (
        company_id, project_id, application_id,
        name, description, fixed_price, total_amount,
        billing_type, status, change_order_id
      ) VALUES (
        NEW.company_id, NEW.project_id, app_id,
        'CO#' || SUBSTRING(NEW.co_number FROM 4) || ' - ' || (item->>'name'),
        COALESCE(item->>'description', NEW.description),
        COALESCE((item->>'amount')::numeric, 0),
        COALESCE((item->>'amount')::numeric, 0),
        'fixed', 'not_started', NEW.id
      );
    END LOOP;
  ELSE
    INSERT INTO public.services (
      company_id, project_id, application_id,
      name, description, fixed_price, total_amount,
      billing_type, status, change_order_id
    ) VALUES (
      NEW.company_id, NEW.project_id, app_id,
      'CO#' || SUBSTRING(NEW.co_number FROM 4) || ' - ' || NEW.title,
      NEW.description,
      NEW.amount, NEW.amount,
      'fixed', 'not_started', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_co_create_services
AFTER UPDATE ON public.change_orders
FOR EACH ROW
EXECUTE FUNCTION public.create_services_from_approved_co();
