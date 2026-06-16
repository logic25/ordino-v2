-- Restore admin SELECT on Beacon analytics tables.
-- Regression: 20260610214137 dropped the "Admins can view beacon interactions"
-- policy, locking the tables to service_role, so the AI Usage dashboard read 0
-- rows (138 interactions exist but RLS blocked the signed-in admin). The
-- intended re-fix used is_company_admin(current_user_company_id()), which returns
-- false for the user, so it never took. Reverting to has_app_role(auth.uid(),
-- 'admin') — the check that worked pre-regression. Single-tenant GLE today, so
-- this is the GLE admins seeing GLE's own Beacon analytics. (Multi-tenant scoping
-- is a separate expansion prerequisite — see notes; these tables have no company_id.)
-- Idempotent.

drop policy if exists "Admins can view beacon interactions" on public.beacon_interactions;
create policy "Admins can view beacon interactions" on public.beacon_interactions
  for select to authenticated using (public.has_app_role(auth.uid(), 'admin'));

drop policy if exists "Admins can view beacon api usage" on public.beacon_api_usage;
create policy "Admins can view beacon api usage" on public.beacon_api_usage
  for select to authenticated using (public.has_app_role(auth.uid(), 'admin'));

drop policy if exists "Admins can view beacon feedback" on public.beacon_feedback;
create policy "Admins can view beacon feedback" on public.beacon_feedback
  for select to authenticated using (public.has_app_role(auth.uid(), 'admin'));

drop policy if exists "Admins can view beacon corrections" on public.beacon_corrections;
create policy "Admins can view beacon corrections" on public.beacon_corrections
  for select to authenticated using (public.has_app_role(auth.uid(), 'admin'));
