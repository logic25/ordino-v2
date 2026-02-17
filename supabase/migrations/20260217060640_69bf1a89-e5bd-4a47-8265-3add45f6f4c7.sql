-- Allow anon role to insert notifications (for client-facing actions like signing proposals, submitting PIS)
CREATE POLICY "Public pages can create notifications"
  ON public.notifications
  FOR INSERT
  TO anon
  WITH CHECK (true);