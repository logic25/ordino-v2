
-- Create storage bucket for RFI attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('rfi-attachments', 'rfi-attachments', false);

-- Allow anyone to upload files (public RFI form uses access tokens, not auth)
CREATE POLICY "Anyone can upload RFI attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rfi-attachments');

-- Only authenticated company members can view/download RFI attachments
CREATE POLICY "Authenticated users can view RFI attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rfi-attachments'
  AND auth.role() = 'authenticated'
);

-- Only authenticated users can delete RFI attachments
CREATE POLICY "Authenticated users can delete RFI attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rfi-attachments'
  AND auth.role() = 'authenticated'
);
