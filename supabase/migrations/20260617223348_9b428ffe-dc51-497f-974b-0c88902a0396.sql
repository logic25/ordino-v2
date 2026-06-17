-- Lock employee_compensation UPDATE to comp admins only
DROP POLICY IF EXISTS "Users can update own compensation or admins can update all" ON public.employee_compensation;
DROP POLICY IF EXISTS "Comp admins can update compensation" ON public.employee_compensation;

CREATE POLICY "Comp admins can update compensation"
ON public.employee_compensation
FOR UPDATE
TO authenticated
USING (public.is_comp_admin(auth.uid()))
WITH CHECK (public.is_comp_admin(auth.uid()));

-- Drop the self-service RPC entirely (bypass via SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.set_my_hourly_rate(numeric);
DROP FUNCTION IF EXISTS public.set_my_hourly_rate(_rate numeric);
