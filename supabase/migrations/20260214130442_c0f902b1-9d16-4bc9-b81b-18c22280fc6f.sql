
-- Create storage bucket for RFP document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('rfp-documents', 'rfp-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload to their company folder
CREATE POLICY "Authenticated users can upload rfp docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rfp-documents'
  AND auth.role() = 'authenticated'
);

-- RLS: Authenticated users can read rfp docs
CREATE POLICY "Authenticated users can read rfp docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rfp-documents'
  AND auth.role() = 'authenticated'
);

-- RLS: Authenticated users can delete rfp docs
CREATE POLICY "Authenticated users can delete rfp docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rfp-documents'
  AND auth.role() = 'authenticated'
);
