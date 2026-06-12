# BD Events overhaul + Chat-style discussion + Lead editing affordance

Approved scope from your three answers: **Y / Y / (b) split sections**. This is the final plan I'll execute on switch to build.

---

## Step 0 — verify schema live (before any code)

Run via read_query:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('bd_events','bd_event_attendees','bd_event_tasks',
                     'project_action_items','leads','bd_activities')
ORDER BY table_name, ordinal_position;

SELECT enum_range(NULL::bd_activity_type);

-- Confirm RLS helper exists:
SELECT proname FROM pg_proc WHERE proname = 'is_company_member';
```
Paste results in the first build response. If `is_company_member` doesn't exist, swap the RLS policy for an inline `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = bd_event_tasks.company_id)` check.

Known facts already confirmed: `bd_events.name` (not event_name), `bd_events.start_time` + `end_time` already exist, `project_action_items.project_id` is NOT NULL (so we do NOT add `event_id` to it).

---

## Migration: `supabase/migrations/<ts>_bd_events_form_overhaul.sql`

New table only — `bd_event_tasks` exactly as you spec'd:
- columns: `id, company_id, event_id, title, assigned_to, due_date, status (open|in_progress|done), created_by, created_at, updated_at`
- indexes on `event_id`, partial on `assigned_to`
- GRANTs to `authenticated` (CRUD) + `service_role` (ALL)
- RLS via `is_company_member(company_id)` (with fallback if helper missing)
- `update_updated_at_column()` trigger

---

## A. Events fixes (your 7 + iCal)

### A1. "Going" column on Events table
- New column in `BdEvents.tsx` table: avatar stack (max 3 + `+N`).
- One batched query: `bd_event_attendees` filtered by current page's event IDs, joined to `profiles` for name/initials.
- Empty → dash.

### A2. Attendees picker in edit dialog
- Extract `AttendeesPicker` out of `BdEventDetail.tsx` into `src/components/bd/AttendeesPicker.tsx`.
- Use it in both the edit dialog and the detail page (one implementation per concept).
- Existing `useAddEventAttendee` / `useRemoveEventAttendee` unchanged.

### A3. Prep panel scoped to event attendees
- "Who you know going": after fetching this event's attendees, query leads where `assigned_to IN (attendees) OR created_by IN (attendees)`, derive the brokerages/companies, then show TIMS leads + contacts at those companies only.
- No attendees → exact copy: **"Add team members going to this event to see warm paths."**
- "Others in this market": render only when BOTH `target_audience` AND `category` are set. Otherwise hide the whole subsection.

### A4. Start / end times
- Add `<Input type="time">` for Start time and End time under Schedule on both detail page and edit dialog.
- **All-day** checkbox → clears + hides time inputs when checked.
- On save: if `start_date` set and `end_date` empty → default `end_date = start_date`.
- Header + table format: `Jun 16, 8:00–9:30 AM` (omit time if all-day or null).

### A5. Draft strategy with AI
- New edge function `supabase/functions/draft-event-strategy/index.ts`:
  - JWT auth (user, not cron-secret).
  - Input: `{ event_name, source_url, category, target_audience, why_it_matters? }`.
  - Model: `google/gemini-2.5-flash` via Lovable AI gateway (`LOVABLE_API_KEY`), same pattern as `parse-event-url`.
  - Returns JSON: `{ why_it_matters, recent_news, key_attendees, competitive_landscape }`, each 2–4 sentences with GLE-specific framing (NYC permit expediting, DOB filings).
  - 402/429 surfaced as toast.
- **Draft strategy with AI** button at top of Strategy card on detail page; pre-fills the 4 fields as editable drafts. Notes stays human-only.

### A6. Cost section cleanup
- Remove `price_verified` field/dropdown from UI. Replace with inline **"✓ Verified"** badge that auto-shows when `cost_actual` is set. (DB column stays for back-compat.)
- Collapse `included_in_membership` checkbox + `membership_id` picker → single membership picker; when set, auto-sets member price to `$0`.
- Member / Non-member / Actual paid render in one compact row.
- Keep `paid_by`.

### A7. Event tasks — split section pattern (per your answer b)
- New `EventTasksCard` component below Strategy on event detail page.
- New `useEventTasks(eventId)` hook reading/writing `bd_event_tasks`.
- Inline add row: title (required) + assignee dropdown (company profiles) + due date.
- Checkbox toggles `status='done'`.
- **Action Items page** stays exactly as-is at the top (`project_action_items`). Add a **second section underneath** titled "Event prep tasks" using a separate lightweight component + `useMyEventTasks()` hook (scoped to `assigned_to = auth.uid()`). Each row shows title, due date, an "Event: <name>" chip linking `/bd/events/:id`. No fake columns, no shared interface.

### A8. iCal export
- "Add to Calendar" button on detail header (shown when `start_date` is set).
- Client-side `.ics` generation: VEVENT with `DTSTART` / `DTEND` (DATE-only if all-day, DATE-TIME otherwise), `SUMMARY=name`, `LOCATION`, `URL=source_url`. Download via Blob + anchor click.
- No edge function.

---

## B. Chat-style discussion (rewrite `BdActivityThread.tsx`)

No schema change — same `bd_activities` table, type `NOTE`. Used on both Lead and Event detail pages (fixes both at once).

- **Persistent composer** pinned at the bottom: Textarea + Send button. Enter sends, Shift+Enter newline. No "Add Note" toggle.
- **Bubble layout**: own messages right-aligned with `bg-primary text-primary-foreground`, others left-aligned with avatar + name. Timestamp above bubble.
- **System rows** (STAGE_CHANGE, STATUS_CHANGE, APPROVAL, PROPOSAL_CREATED, EMAIL, SYSTEM) → centered inline dividers ("Manny advanced stage to Qualified · 2h"), not bubbles.
- **Pinned** messages render above with a small "📌 Pinned" tag instead of hover-only icon.
- **Auto-scroll to bottom** on mount and on new message; preserve scroll on older renders.
- **@mention autocomplete** from company profiles → writes user ids into the existing `mentions` array column → triggers notifications via existing trigger pattern (verify trigger exists in step 0; if not, skip mention notifications this batch and log a follow-up).
- Public props (`filter`, `extraActions`, `emptyText`) remain backward-compatible — no changes needed at call sites in `BdLeadDetail.tsx` or `BdEventDetail.tsx`.
- Note: AI Elements chat primitives don't apply here — this is human-to-human discussion, not an AI agent surface. (Documented exception to the chat-ui-composition gate.)

---

## C. Lead editing affordance (CSS + copy only — zero backend)

The fields in `BdLeadDetail.tsx` already save on blur via `EditableText`. The problem is discoverability.

- Update `EditableText` + `Field` row:
  - Hover background `hover:bg-muted/40` + a small pencil icon on the right (`opacity-0 group-hover:opacity-60`).
  - Empty value → muted "Add role" / "Add email" / "Add phone" / "Add property" / etc., not "—". Wire the label from a `placeholder` prop already accepted.
  - Focus ring + visible border when input opens.
- **Edit details** button in header (sibling to Advance stage / Add Note / Log Call) → scrolls to and focus-opens the first empty `EditableText`. Pure UX hook, no new state.

---

## Technical details

- **Files created (5):**
  - `supabase/migrations/<ts>_bd_events_form_overhaul.sql`
  - `supabase/functions/draft-event-strategy/index.ts`
  - `src/components/bd/AttendeesPicker.tsx`
  - `src/components/bd/EventTasksCard.tsx`
  - `src/hooks/useEventTasks.ts`
- **Files edited (6):**
  - `src/pages/bd/BdEventDetail.tsx` — times, AI button, cost cleanup, tasks card, iCal button, use shared AttendeesPicker.
  - `src/pages/bd/BdEvents.tsx` — Going column, attendees in edit dialog, time display.
  - `src/components/bd/EventPrepPanel.tsx` — attendee-scoped warm paths, hide market section when criteria missing.
  - `src/components/bd/BdActivityThread.tsx` — chat-style rewrite.
  - `src/pages/bd/BdLeadDetail.tsx` — Edit details button, scroll/focus helper. Reuses updated `EditableText`.
  - `src/pages/ActionItems.tsx` (or equivalent) — append "Event prep tasks" section.
- **Hooks edited:** extend `BdEvent` type in `useBdEvents.ts` with `start_time` / `end_time` (already in DB).
- **Changelog:** insert one `changelog_entries` row covering all of A+B+C.
- **Memory:** no new memories — this is a feature build, not a doctrine change.

---

## Doctrine verification — pastes required after build

1. `SELECT id, title, assigned_to, status FROM bd_event_tasks WHERE event_id = '<event id>' LIMIT 5;` — confirms insert works with no `project_id`.
2. Open an event with **0 attendees** → screenshot shows "Add team members going to this event to see warm paths." (not a global TIMS firm list).
3. Set a `start_time` on an event, save → screenshot header showing `Jun 16, 8:00 AM` format.
4. Click "Draft strategy with AI" → paste the 4 returned fields verbatim.
5. Click "Add to Calendar" → confirm `.ics` downloads with correct `DTSTART`.
6. Open `BdLeadDetail` → screenshot a hover row showing pencil icon + "Add role" empty state.
7. Open Discussion on any lead → screenshot showing bubble layout + persistent bottom composer.

I won't mark complete until all 7 pastes are in.

Switch to build and I'll execute.
