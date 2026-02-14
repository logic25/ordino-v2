
-- Create attendance_logs table for daily clock-in/out tracking
CREATE TABLE public.attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  clock_in_location text,
  ip_address text,
  total_minutes integer,
  auto_closed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- Enable RLS
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own attendance logs
CREATE POLICY "Users can view own attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (
    user_id = (SELECT user_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_admin_or_manager(company_id)
  );

-- Users can insert their own attendance logs
CREATE POLICY "Users can insert own attendance logs"
  ON public.attendance_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company_id()
  );

-- Users can update their own, admins can update any within company
CREATE POLICY "Users can update own attendance logs"
  ON public.attendance_logs FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  );

-- Only admins can delete
CREATE POLICY "Admins can delete attendance logs"
  ON public.attendance_logs FOR DELETE
  USING (public.is_company_admin(company_id));

-- Trigger for updated_at
CREATE TRIGGER update_attendance_logs_updated_at
  BEFORE UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_attendance_logs_user_date ON public.attendance_logs(user_id, log_date DESC);
CREATE INDEX idx_attendance_logs_company_date ON public.attendance_logs(company_id, log_date DESC);
