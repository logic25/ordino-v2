-- Let company admins approve/reject Beacon KB correction suggestions from inside
-- Ordino (the AI Usage dashboard). Beacon's side ingests rows once status flips to
-- 'approved' (via get_approved_corrections). Scoped to admins so a regular member
-- can't alter what gets pushed into the knowledge base.

drop policy if exists "admins review beacon suggestions" on public.beacon_suggestions;
create policy "admins review beacon suggestions" on public.beacon_suggestions
  for update to authenticated
  using (public.is_company_admin(public.current_user_company_id()))
  with check (public.is_company_admin(public.current_user_company_id()));
