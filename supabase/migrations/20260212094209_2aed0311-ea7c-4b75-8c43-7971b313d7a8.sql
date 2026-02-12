-- Fix the generate_project_number trigger to safely handle existing non-standard project numbers
CREATE OR REPLACE FUNCTION public.generate_project_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN project_number ~ ('^PJ' || year_str || '-[0-9]+$')
      THEN CAST(SUBSTRING(project_number FROM LENGTH('PJ' || year_str || '-') + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.projects
  WHERE project_number LIKE 'PJ' || year_str || '-%'
    AND company_id = NEW.company_id;
  
  NEW.project_number := 'PJ' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;