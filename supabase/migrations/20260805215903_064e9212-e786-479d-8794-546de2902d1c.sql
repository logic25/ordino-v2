create or replace function public.get_kb_gap_interactions(_limit integer default 5000)
returns table (
  id bigint,
  question text,
  response text,
  confidence numeric,
  answered boolean,
  command text,
  topic text,
  space_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.question, b.response, b.confidence, b.answered, b.command, b.topic, b.space_name
  from public.beacon_interactions b
  where b.addressed_at is null
    and (
      public.is_company_admin(public.get_user_company_id())
      or public.has_role(auth.uid(), 'manager'::user_role)
    )
  order by b.id desc
  limit least(coalesce(_limit, 5000), 5000)
$$;

create or replace function public.mark_kb_gaps_addressed(_ids bigint[], _note text)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not (
    public.is_company_admin(public.get_user_company_id())
    or public.has_role(auth.uid(), 'manager'::user_role)
  ) then
    raise exception 'not authorized';
  end if;

  update public.beacon_interactions
     set addressed_at = now(),
         addressed_note = _note,
         addressed_by = auth.uid()
   where id = any(_ids)
     and addressed_at is null;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.get_kb_gap_interactions(integer) from public, anon;
revoke all on function public.mark_kb_gaps_addressed(bigint[], text) from public, anon;
grant execute on function public.get_kb_gap_interactions(integer) to authenticated;
grant execute on function public.mark_kb_gaps_addressed(bigint[], text) to authenticated;