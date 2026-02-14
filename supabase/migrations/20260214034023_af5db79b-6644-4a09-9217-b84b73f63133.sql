
-- =============================================
-- ORDINO BILLING SYSTEM - Phase A: Database Schema
-- =============================================

-- 1. INVOICES table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  invoice_number VARCHAR NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  client_id UUID REFERENCES public.clients(id),
  billing_request_id UUID,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  retainer_applied DECIMAL(10,2) DEFAULT 0,
  fees JSONB DEFAULT '{}'::jsonb,
  total_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'draft',
  review_reason TEXT,
  payment_terms VARCHAR DEFAULT 'Net 30',
  due_date DATE,
  billed_to_contact_id UUID REFERENCES public.client_contacts(id),
  created_by UUID REFERENCES public.profiles(id),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_amount DECIMAL(10,2),
  payment_method VARCHAR,
  qbo_invoice_id VARCHAR,
  qbo_synced_at TIMESTAMPTZ,
  qbo_payment_status VARCHAR,
  gmail_message_id VARCHAR,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BILLING_REQUESTS table
CREATE TABLE public.billing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  project_id UUID REFERENCES public.projects(id),
  created_by UUID REFERENCES public.profiles(id),
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'pending',
  billed_to_contact_id UUID REFERENCES public.client_contacts(id),
  invoice_id UUID REFERENCES public.invoices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add billing_request_id FK now that both tables exist
ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_billing_request_id_fkey 
  FOREIGN KEY (billing_request_id) REFERENCES public.billing_requests(id);

-- 3. CLIENT_BILLING_RULES table
CREATE TABLE public.client_billing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  vendor_id VARCHAR,
  property_id UUID REFERENCES public.properties(id),
  require_waiver BOOLEAN DEFAULT false,
  require_pay_app BOOLEAN DEFAULT false,
  wire_fee DECIMAL(10,2) DEFAULT 15,
  cc_markup INTEGER DEFAULT 4,
  special_portal_required BOOLEAN DEFAULT false,
  portal_url TEXT,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INVOICE_ACTIVITY_LOG table
CREATE TABLE public.invoice_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  action VARCHAR NOT NULL,
  details TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INVOICE_FOLLOW_UPS table
CREATE TABLE public.invoice_follow_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  follow_up_date DATE NOT NULL,
  contact_method VARCHAR,
  notes TEXT,
  contacted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. QBO_CONNECTIONS table
CREATE TABLE public.qbo_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  realm_id VARCHAR,
  company_name VARCHAR,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ
);

-- 7. ALTER projects table
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS qbo_customer_id VARCHAR,
  ADD COLUMN IF NOT EXISTS retainer_balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainer_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainer_received_date DATE;

-- =============================================
-- RLS POLICIES
-- =============================================

-- INVOICES RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for invoices"
  ON public.invoices FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins managers and accounting can modify invoices"
  ON public.invoices FOR ALL
  USING (is_admin_or_manager(company_id) OR has_role(company_id, 'accounting'));

-- BILLING_REQUESTS RLS
ALTER TABLE public.billing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for billing_requests"
  ON public.billing_requests FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can create billing_requests"
  ON public.billing_requests FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Admins managers and accounting can modify billing_requests"
  ON public.billing_requests FOR UPDATE
  USING (is_admin_or_manager(company_id) OR has_role(company_id, 'accounting'));

-- CLIENT_BILLING_RULES RLS
ALTER TABLE public.client_billing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for client_billing_rules"
  ON public.client_billing_rules FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins and managers can modify client_billing_rules"
  ON public.client_billing_rules FOR ALL
  USING (is_admin_or_manager(company_id));

-- INVOICE_ACTIVITY_LOG RLS
ALTER TABLE public.invoice_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for invoice_activity_log"
  ON public.invoice_activity_log FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert invoice_activity_log"
  ON public.invoice_activity_log FOR INSERT
  WITH CHECK (is_company_member(company_id));

-- INVOICE_FOLLOW_UPS RLS
ALTER TABLE public.invoice_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for invoice_follow_ups"
  ON public.invoice_follow_ups FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins managers and accounting can modify invoice_follow_ups"
  ON public.invoice_follow_ups FOR ALL
  USING (is_admin_or_manager(company_id) OR has_role(company_id, 'accounting'));

-- QBO_CONNECTIONS RLS
ALTER TABLE public.qbo_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for qbo_connections"
  ON public.qbo_connections FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage qbo_connections"
  ON public.qbo_connections FOR ALL
  USING (is_company_admin(company_id));

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_invoices_qbo_status ON public.invoices(qbo_payment_status);
CREATE INDEX idx_invoices_company ON public.invoices(company_id);
CREATE INDEX idx_billing_requests_company ON public.billing_requests(company_id);
CREATE INDEX idx_client_billing_rules_client ON public.client_billing_rules(client_id);
CREATE INDEX idx_invoice_activity_log_invoice ON public.invoice_activity_log(invoice_id);
CREATE INDEX idx_invoice_follow_ups_invoice ON public.invoice_follow_ups(invoice_id);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_billing_rules_updated_at
  BEFORE UPDATE ON public.client_billing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INVOICE NUMBER GENERATION
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ '^INV-[0-9]+$'
      THEN CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE company_id = NEW.company_id;
  
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invoice_number();
