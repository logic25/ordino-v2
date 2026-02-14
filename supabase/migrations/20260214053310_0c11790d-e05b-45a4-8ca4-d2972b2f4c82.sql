
-- Phase 1: AI Collections Foundation Tables

-- 1. Payment Predictions (AI risk scores per invoice)
CREATE TABLE public.payment_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  predicted_days_late INTEGER,
  predicted_payment_date DATE,
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  factors JSONB DEFAULT '{}',
  model_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view payment predictions" ON public.payment_predictions FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage payment predictions" ON public.payment_predictions FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_payment_predictions_invoice ON public.payment_predictions(invoice_id);
CREATE INDEX idx_payment_predictions_client ON public.payment_predictions(client_id);
CREATE INDEX idx_payment_predictions_company ON public.payment_predictions(company_id);

-- 2. Client Payment Analytics (aggregated payment behavior)
CREATE TABLE public.client_payment_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  avg_days_to_payment DECIMAL(5,2),
  payment_reliability_score INTEGER CHECK (payment_reliability_score >= 0 AND payment_reliability_score <= 100),
  last_12mo_invoices INTEGER DEFAULT 0,
  last_12mo_paid_on_time INTEGER DEFAULT 0,
  last_12mo_late INTEGER DEFAULT 0,
  longest_days_late INTEGER DEFAULT 0,
  preferred_contact_method TEXT,
  best_contact_time TEXT,
  responds_to_reminders BOOLEAN,
  total_lifetime_value DECIMAL(12,2) DEFAULT 0,
  last_payment_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, company_id)
);

ALTER TABLE public.client_payment_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view client analytics" ON public.client_payment_analytics FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage client analytics" ON public.client_payment_analytics FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_client_analytics_client ON public.client_payment_analytics(client_id);

-- 3. Collection Tasks (AI-prioritized worklist)
CREATE TABLE public.collection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 10),
  task_type TEXT NOT NULL CHECK (task_type IN ('gentle_reminder', 'urgent_followup', 'payment_plan_offer', 'escalation')),
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_recommended_action TEXT,
  ai_suggested_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view collection tasks" ON public.collection_tasks FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage collection tasks" ON public.collection_tasks FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_collection_tasks_invoice ON public.collection_tasks(invoice_id);
CREATE INDEX idx_collection_tasks_status ON public.collection_tasks(company_id, status, priority);

-- 4. Payment Promises (promise-to-pay commitments)
CREATE TABLE public.payment_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  follow_up_id UUID REFERENCES public.invoice_follow_ups(id) ON DELETE SET NULL,
  promised_amount DECIMAL(10,2) NOT NULL,
  promised_date DATE NOT NULL,
  payment_method TEXT,
  source TEXT NOT NULL CHECK (source IN ('phone_call', 'email', 'portal', 'in_person')),
  captured_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'kept', 'broken', 'rescheduled')),
  actual_payment_date DATE,
  actual_amount DECIMAL(10,2),
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view payment promises" ON public.payment_promises FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage payment promises" ON public.payment_promises FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_payment_promises_invoice ON public.payment_promises(invoice_id);
CREATE INDEX idx_payment_promises_status ON public.payment_promises(company_id, status, promised_date);

-- 5. Invoice Disputes
CREATE TABLE public.invoice_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('pricing_error', 'service_not_rendered', 'quality_issue', 'duplicate_charge', 'other')),
  amount_disputed DECIMAL(10,2),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_evidence JSONB DEFAULT '[]',
  internal_notes TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.invoice_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view disputes" ON public.invoice_disputes FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage disputes" ON public.invoice_disputes FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_disputes_invoice ON public.invoice_disputes(invoice_id);
CREATE INDEX idx_disputes_status ON public.invoice_disputes(company_id, status);

-- 6. Dispute Messages (threaded conversation)
CREATE TABLE public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.invoice_disputes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'staff')),
  sender_name TEXT,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view dispute messages" ON public.dispute_messages FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage dispute messages" ON public.dispute_messages FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_dispute_messages_dispute ON public.dispute_messages(dispute_id);

-- 7. Cash Forecasts
CREATE TABLE public.cash_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  expected_collections DECIMAL(12,2) NOT NULL DEFAULT 0,
  high_confidence DECIMAL(12,2) NOT NULL DEFAULT 0,
  medium_confidence DECIMAL(12,2) NOT NULL DEFAULT 0,
  low_confidence DECIMAL(12,2) NOT NULL DEFAULT 0,
  factors JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, forecast_date)
);

ALTER TABLE public.cash_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view cash forecasts" ON public.cash_forecasts FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Company admins/managers can manage cash forecasts" ON public.cash_forecasts FOR ALL USING (public.is_admin_or_manager(company_id));

CREATE INDEX idx_cash_forecasts_date ON public.cash_forecasts(company_id, forecast_date);

-- 8. Add write_off_amount to invoices for partial write-off tracking
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS write_off_amount DECIMAL(10,2) DEFAULT 0;
