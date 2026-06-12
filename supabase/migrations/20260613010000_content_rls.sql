-- Let Ordino members (not just the service role) read + manage content candidates
-- and drafts, so the in-app Content module works. These tables have no company_id
-- (single-tenant content KB), so we gate on authenticated.

drop policy if exists "members read content candidates" on public.content_candidates;
create policy "members read content candidates" on public.content_candidates
  for select using (auth.role() = 'authenticated');
drop policy if exists "members update content candidates" on public.content_candidates;
create policy "members update content candidates" on public.content_candidates
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "members read generated content" on public.generated_content;
create policy "members read generated content" on public.generated_content
  for select using (auth.role() = 'authenticated');
drop policy if exists "members write generated content" on public.generated_content;
create policy "members write generated content" on public.generated_content
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
