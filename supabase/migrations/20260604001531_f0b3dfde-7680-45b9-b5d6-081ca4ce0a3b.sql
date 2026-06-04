
CREATE TABLE public.project_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  description TEXT NOT NULL,
  vendor TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  markup_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  billable_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(amount * (1 + markup_pct/100.0), 2)) STORED,
  incurred_date DATE,
  receipt_url TEXT,
  billed_to_contact_id UUID REFERENCES public.client_contacts(id),
  status TEXT NOT NULL DEFAULT 'pending_approval',
  hold_reason TEXT,
  approval_status TEXT NOT NULL DEFAULT 'not_required',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  denied_reason TEXT,
  billing_request_id UUID REFERENCES public.billing_requests(id) ON DELETE SET NULL,
  invoice_line_id UUID,
  qbo_expense_id TEXT,
  qbo_bill_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_expenses_project ON public.project_expenses(project_id);
CREATE INDEX idx_project_expenses_company ON public.project_expenses(company_id);
CREATE INDEX idx_project_expenses_approval ON public.project_expenses(approval_status) WHERE approval_status = 'pending';
CREATE INDEX idx_project_expenses_status ON public.project_expenses(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_expenses TO authenticated;
GRANT ALL ON public.project_expenses TO service_role;

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view expenses"
  ON public.project_expenses FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can create expenses"
  ON public.project_expenses FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Creator or admin/manager can update"
  ON public.project_expenses FOR UPDATE
  USING (
    is_admin_or_manager(company_id)
    OR created_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Creator or admin/manager can delete"
  ON public.project_expenses FOR DELETE
  USING (
    is_admin_or_manager(company_id)
    OR created_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TRIGGER update_project_expenses_updated_at
  BEFORE UPDATE ON public.project_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.expense_create_billing_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_br_id UUID;
BEGIN
  IF NEW.status = 'pending_billing'
     AND NEW.billing_request_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_billing')
  THEN
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
        'billable_amount', NEW.billable_amount
      )),
      NEW.billable_amount, 'pending', NEW.billed_to_contact_id
    ) RETURNING id INTO new_br_id;
    NEW.billing_request_id := new_br_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expense_create_billing_request
  BEFORE INSERT OR UPDATE OF status ON public.project_expenses
  FOR EACH ROW EXECUTE FUNCTION public.expense_create_billing_request();

CREATE POLICY "Auth users can upload expense receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

CREATE POLICY "Auth users can read expense receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts');

CREATE POLICY "Auth users can update expense receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts');

CREATE POLICY "Auth users can delete expense receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-receipts');
