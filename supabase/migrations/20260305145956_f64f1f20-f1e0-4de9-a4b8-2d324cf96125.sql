
-- Drop the overbroad anon SELECT policy on change_orders
DROP POLICY IF EXISTS "Public can read CO by token" ON public.change_orders;

-- Drop the overbroad anon UPDATE policy on change_orders
DROP POLICY IF EXISTS "Public can sign CO via token" ON public.change_orders;
