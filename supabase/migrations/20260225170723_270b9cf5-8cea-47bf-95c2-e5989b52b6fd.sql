
-- Billing schedules for recurring auto-billing
CREATE TABLE public.billing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  project_id uuid REFERENCES public.projects(id) NOT NULL,
  service_id uuid REFERENCES public.services(id),
  service_name text NOT NULL,
  billing_method text NOT NULL DEFAULT 'amount',
  billing_value numeric NOT NULL,
  billed_to_contact_id uuid REFERENCES public.client_contacts(id),
  frequency text NOT NULL DEFAULT 'monthly',
  next_bill_date date NOT NULL,
  last_billed_at timestamptz,
  is_active boolean DEFAULT true,
  auto_approve boolean DEFAULT false,
  max_occurrences int,
  occurrences_completed int DEFAULT 0,
  end_date date,
  created_by uuid REFERENCES public.profiles(id),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.billing_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their company schedules" ON public.billing_schedules
  FOR ALL USING (company_id = public.get_user_company_id());

-- Billing notification preferences per user
CREATE TABLE public.billing_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  is_enabled boolean DEFAULT true,
  frequency text NOT NULL DEFAULT 'immediate',
  digest_day text DEFAULT 'monday',
  digest_time time DEFAULT '09:00',
  include_service_details boolean DEFAULT true,
  include_billed_to boolean DEFAULT true,
  include_project_link boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.billing_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their company notification prefs" ON public.billing_notification_preferences
  FOR ALL USING (company_id = public.get_user_company_id());

-- Billing notification queue for digest mode
CREATE TABLE public.billing_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  billing_request_id uuid REFERENCES public.billing_requests(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  processed_at timestamptz
);

ALTER TABLE public.billing_notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company notification queue" ON public.billing_notification_queue
  FOR ALL USING (company_id = public.get_user_company_id());

-- Add validation trigger for billing_method
CREATE OR REPLACE FUNCTION public.validate_billing_schedule()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.billing_method NOT IN ('amount', 'percentage') THEN
    RAISE EXCEPTION 'billing_method must be amount or percentage';
  END IF;
  IF NEW.frequency NOT IN ('weekly', 'biweekly', 'monthly', 'quarterly') THEN
    RAISE EXCEPTION 'frequency must be weekly, biweekly, monthly, or quarterly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_billing_schedule
  BEFORE INSERT OR UPDATE ON public.billing_schedules
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_schedule();

-- Validate notification frequency
CREATE OR REPLACE FUNCTION public.validate_billing_notification_pref()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.frequency NOT IN ('immediate', 'daily', 'weekly') THEN
    RAISE EXCEPTION 'frequency must be immediate, daily, or weekly';
  END IF;
  IF NEW.digest_day NOT IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday') THEN
    RAISE EXCEPTION 'invalid digest_day';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_billing_notification_pref
  BEFORE INSERT OR UPDATE ON public.billing_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_notification_pref();
