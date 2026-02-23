
-- Create document_folders table
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  description text,
  is_system boolean DEFAULT false,
  is_beacon_synced boolean DEFAULT false
);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view folders in their company"
  ON public.document_folders FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can create folders in their company"
  ON public.document_folders FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update non-system folders in their company"
  ON public.document_folders FOR UPDATE
  USING (public.is_company_member(company_id) AND is_system = false);

CREATE POLICY "Users can delete non-system folders in their company"
  ON public.document_folders FOR DELETE
  USING (public.is_company_member(company_id) AND is_system = false);

-- Add new columns to universal_documents
ALTER TABLE public.universal_documents ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL;
ALTER TABLE public.universal_documents ADD COLUMN IF NOT EXISTS beacon_status text DEFAULT NULL;
ALTER TABLE public.universal_documents ADD COLUMN IF NOT EXISTS beacon_synced_at timestamptz;
ALTER TABLE public.universal_documents ADD COLUMN IF NOT EXISTS beacon_chunks integer;

-- Create function to seed default folders for a company
CREATE OR REPLACE FUNCTION public.seed_document_folders(target_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guides_id uuid;
  dob_id uuid;
  cases_id uuid;
  beacon_id uuid;
  sub_id uuid;
BEGIN
  -- Check if already seeded
  IF EXISTS (SELECT 1 FROM document_folders WHERE company_id = target_company_id AND is_system = true LIMIT 1) THEN
    RETURN;
  END IF;

  -- Guides & SOPs
  INSERT INTO document_folders (company_id, name, description, is_system)
  VALUES (target_company_id, 'Guides & SOPs', 'Internal reference guides, standard operating procedures', true)
  RETURNING id INTO guides_id;

  INSERT INTO document_folders (company_id, name, parent_id, description, is_system) VALUES
    (target_company_id, 'Permit Filing Guides', guides_id, 'DOB filing guides: ALT1, ALT2, ALT3, NB, DM, PAA procedures', true),
    (target_company_id, 'Zoning References', guides_id, 'Zoning resolution guides, use group references, FAR calculations', true),
    (target_company_id, 'Violation Guides', guides_id, 'DOB/ECB/HPD violation resolution and dismissal guides', true),
    (target_company_id, 'Code References', guides_id, 'Building Code, Multiple Dwelling Law, Housing Maintenance Code', true),
    (target_company_id, 'Company SOPs', guides_id, 'Internal workflows, processes, team procedures', true);

  -- DOB Notices & Bulletins
  INSERT INTO document_folders (company_id, name, description, is_system)
  VALUES (target_company_id, 'DOB Notices & Bulletins', 'Official DOB publications and updates', true)
  RETURNING id INTO dob_id;

  INSERT INTO document_folders (company_id, name, parent_id, description, is_system) VALUES
    (target_company_id, 'Service Notices', dob_id, 'DOB service updates, fee changes, schedule changes', true),
    (target_company_id, 'Buildings Bulletins', dob_id, 'Official DOB buildings bulletins (BB-2024-001, etc.)', true),
    (target_company_id, 'Technical Bulletins', dob_id, 'Technical guidance and compliance bulletins', true),
    (target_company_id, 'Policy Memos', dob_id, 'DOB policy memoranda', true);

  -- Case Files & Precedents
  INSERT INTO document_folders (company_id, name, description, is_system)
  VALUES (target_company_id, 'Case Files & Precedents', 'Historical project resolutions and reference cases', true)
  RETURNING id INTO cases_id;

  -- Beacon Knowledge Base
  INSERT INTO document_folders (company_id, name, description, is_system, is_beacon_synced)
  VALUES (target_company_id, 'Beacon Knowledge Base', 'Source documents that power Beacon AI', true, true)
  RETURNING id INTO beacon_id;
END;
$$;
