CREATE POLICY "Public can sign CO via token"
ON public.change_orders
FOR UPDATE
TO anon, authenticated
USING (public_token IS NOT NULL)
WITH CHECK (public_token IS NOT NULL);