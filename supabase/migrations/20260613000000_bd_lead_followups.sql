-- BD follow-up cadence: a personal "don't forget to follow up" nudge on leads.
-- This is NOT bd_sequences (automated outbound email). It's a reminder to the PM
-- to make a *personal* touch, surfaced in a "Follow-ups due" view.
alter table public.leads
  add column if not exists next_follow_up_at date,
  add column if not exists follow_up_note text;

create index if not exists idx_leads_next_follow_up
  on public.leads (company_id, next_follow_up_at)
  where next_follow_up_at is not null;
