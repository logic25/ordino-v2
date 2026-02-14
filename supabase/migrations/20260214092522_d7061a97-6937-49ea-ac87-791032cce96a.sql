
-- Add package fields to claimflow_referrals
ALTER TABLE public.claimflow_referrals 
  ADD COLUMN IF NOT EXISTS package_storage_path text,
  ADD COLUMN IF NOT EXISTS package_generated_at timestamptz;

-- Create storage bucket for claimflow legal packages
INSERT INTO storage.buckets (id, name, public)
VALUES ('claimflow-packages', 'claimflow-packages', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: company members can read their own packages
CREATE POLICY "Company members can view claimflow packages"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'claimflow-packages' 
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

-- RLS: company members can upload packages
CREATE POLICY "Company members can upload claimflow packages"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'claimflow-packages'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE user_id = auth.uid()
  )
);
