
-- Automation rules: configurable collection reminder/escalation triggers
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL DEFAULT 'collection_reminder', -- collection_reminder, escalation, status_change
  trigger_type TEXT NOT NULL DEFAULT 'days_overdue', -- days_overdue, days_since_last_contact, promise_broken
  trigger_value INTEGER NOT NULL DEFAULT 30, -- e.g. 30 days
  action_type TEXT NOT NULL DEFAULT 'generate_reminder', -- generate_reminder, escalate, change_status, notify
  action_config JSONB NOT NULL DEFAULT '{}', -- tone, template, escalate_to, etc.
  conditions JSONB NOT NULL DEFAULT '{}', -- min_amount, client_type, exclude_disputed, etc.
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0, -- execution order
  max_executions INTEGER, -- null = unlimited
  cooldown_hours INTEGER NOT NULL DEFAULT 72, -- min hours between re-triggers for same invoice
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation execution log: tracks every rule execution
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  action_taken TEXT NOT NULL, -- what the rule did
  result TEXT NOT NULL DEFAULT 'pending', -- pending, awaiting_approval, approved, sent, escalated, skipped, failed
  generated_message TEXT, -- AI-generated message content
  escalated_to UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_automation_rules_company ON public.automation_rules(company_id);
CREATE INDEX idx_automation_rules_enabled ON public.automation_rules(company_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_automation_logs_company ON public.automation_logs(company_id);
CREATE INDEX idx_automation_logs_rule ON public.automation_logs(rule_id);
CREATE INDEX idx_automation_logs_invoice ON public.automation_logs(invoice_id);
CREATE INDEX idx_automation_logs_result ON public.automation_logs(company_id, result);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for automation_rules
CREATE POLICY "Company members can view automation rules"
  ON public.automation_rules FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins and managers can manage automation rules"
  ON public.automation_rules FOR ALL
  USING (public.is_admin_or_manager(company_id))
  WITH CHECK (public.is_admin_or_manager(company_id));

-- RLS policies for automation_logs
CREATE POLICY "Company members can view automation logs"
  ON public.automation_logs FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins and managers can manage automation logs"
  ON public.automation_logs FOR ALL
  USING (public.is_admin_or_manager(company_id))
  WITH CHECK (public.is_admin_or_manager(company_id));

-- Updated_at trigger for rules
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
