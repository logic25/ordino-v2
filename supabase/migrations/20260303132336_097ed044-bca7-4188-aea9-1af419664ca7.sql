
-- Table for tracking CO sign-offs per property
CREATE TABLE public.co_sign_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  tco_required BOOLEAN NOT NULL DEFAULT false,
  sign_off_date TEXT,
  job_num TEXT,
  expiration_date TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.co_sign_offs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their company sign-offs"
  ON public.co_sign_offs FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can create sign-offs for their company"
  ON public.co_sign_offs FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Users can update their company sign-offs"
  ON public.co_sign_offs FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can delete their company sign-offs"
  ON public.co_sign_offs FOR DELETE
  USING (public.is_company_member(company_id));

-- Timestamp trigger
CREATE TRIGGER update_co_sign_offs_updated_at
  BEFORE UPDATE ON public.co_sign_offs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_co_sign_offs_property ON public.co_sign_offs(property_id);
