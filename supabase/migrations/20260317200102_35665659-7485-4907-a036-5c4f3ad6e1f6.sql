
ALTER TABLE public.signal_subscriptions
  ADD COLUMN is_complimentary boolean NOT NULL DEFAULT false,
  ADD COLUMN enrolled_by uuid REFERENCES public.profiles(id),
  ADD COLUMN linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN monthly_rate numeric DEFAULT null,
  ADD COLUMN billing_start_date date DEFAULT null,
  ADD COLUMN comp_reason text DEFAULT null;
