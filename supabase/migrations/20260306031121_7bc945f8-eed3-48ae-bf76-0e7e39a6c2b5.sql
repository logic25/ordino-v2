
-- Create changelog_entries table
CREATE TABLE public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT 'feature',
  loom_url text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

-- Authenticated company members can read
CREATE POLICY "Company members can view changelog"
  ON public.changelog_entries FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- Admins can insert
CREATE POLICY "Admins can insert changelog"
  ON public.changelog_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

-- Admins can update
CREATE POLICY "Admins can update changelog"
  ON public.changelog_entries FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

-- Admins can delete
CREATE POLICY "Admins can delete changelog"
  ON public.changelog_entries FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));
