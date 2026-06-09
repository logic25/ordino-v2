
-- Backfill company_id via auth.users -> profiles lookup
UPDATE public.widget_messages w
SET company_id = p.company_id
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE w.company_id IS NULL
  AND u.email = w.user_email;

-- Remove any remaining orphan rows (unreachable)
DELETE FROM public.widget_messages WHERE company_id IS NULL;

ALTER TABLE public.widget_messages ALTER COLUMN company_id SET NOT NULL;

DROP POLICY IF EXISTS "Users can read own messages" ON public.widget_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.widget_messages;
DROP POLICY IF EXISTS "Users can soft-delete own messages" ON public.widget_messages;
DROP POLICY IF EXISTS "Users can soft-delete own widget messages" ON public.widget_messages;

CREATE POLICY "Users can read own messages"
  ON public.widget_messages FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = user_email
    AND public.is_company_member(company_id)
  );

CREATE POLICY "Users can insert own messages"
  ON public.widget_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = user_email
    AND public.is_company_member(company_id)
  );

CREATE POLICY "Users can soft-delete own messages"
  ON public.widget_messages FOR UPDATE
  TO authenticated
  USING (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    AND public.is_company_member(company_id)
  )
  WITH CHECK (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    AND public.is_company_member(company_id)
  );
