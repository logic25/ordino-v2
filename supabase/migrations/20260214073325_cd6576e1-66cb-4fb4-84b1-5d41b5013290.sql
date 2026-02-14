
-- ============================================
-- 1. APP ROLES ENUM & USER_ROLES TABLE
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'production', 'accounting');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to check app_role without recursion
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_app_roles(_user_id uuid)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), '{}')
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS: users see own roles, admins see all in company
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view company roles"
  ON public.user_roles FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_app_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_app_role(auth.uid(), 'admin'));

-- Auto-assign 'admin' app_role when a profile with role='admin' is created
-- This bridges the existing profile.role to the new user_roles table
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Map existing profile roles to new app_roles
  IF NEW.role::text = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (NEW.user_id, 'admin'::app_role, NEW.company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_profile_role
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_to_user_roles();

-- Backfill existing admin profiles
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT user_id, 'admin'::app_role, company_id
FROM public.profiles
WHERE role::text = 'admin'
ON CONFLICT (user_id, role, company_id) DO NOTHING;

-- ============================================
-- 2. PAYMENT PLANS & INSTALLMENTS
-- ============================================

CREATE TABLE public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL,
  num_installments int NOT NULL DEFAULT 3,
  interest_rate numeric DEFAULT 0,
  down_payment numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.payment_plans(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  installment_number int NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  paid_at timestamptz,
  paid_amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view payment plans"
  ON public.payment_plans FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can manage payment plans"
  ON public.payment_plans FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can view installments"
  ON public.payment_plan_installments FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can manage installments"
  ON public.payment_plan_installments FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Timestamp trigger
CREATE TRIGGER update_payment_plans_updated_at
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
