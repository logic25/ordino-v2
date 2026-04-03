-- Add soft-delete column
ALTER TABLE public.widget_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Allow users to soft-delete their own messages
CREATE POLICY "Users can soft-delete own widget messages"
ON public.widget_messages
FOR UPDATE
TO authenticated
USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));