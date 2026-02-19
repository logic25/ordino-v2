-- Roadmap items table
CREATE TABLE public.roadmap_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'gap',
  priority TEXT NOT NULL DEFAULT 'medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  feature_request_id UUID REFERENCES public.feature_requests(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view roadmap items"
  ON public.roadmap_items FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage roadmap items"
  ON public.roadmap_items FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE TRIGGER update_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();