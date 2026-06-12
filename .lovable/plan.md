## Batch: BD Card cleanup + Event simplification + Chat identity/mentions + AI-event flow

### 1. My Card tab (`src/pages/bd/_bdcard/BdMyCardTab.tsx`)
- Remove the "Print" button entirely (line 268) and the `Printer` import.
- Demote "Download .vcf" to a small, secondary control: `variant="ghost"`, `size="sm"`, icon + short label "Save contact (.vcf)", aligned right under the card preview instead of a full-width button row.
- Result: the action bar stops competing with the card itself; vCard download is still one click but no longer shouts.

### 2. Event detail simplification (`src/pages/bd/BdEventDetail.tsx`)
- Collapse `start_time` / `end_time` / "All day" toggle into a single **Date** field (`event_date`, all-day implied). Header reads "Jun 16" — no more "9:00 AM" formatting.
- iCal export keeps working: `DTSTART;VALUE=DATE` + next-day `DTEND;VALUE=DATE` (Google all-day convention).
- Remove the "Next action" `EditableText` block (lines ~336–337) and stop reading/writing `next_action` from this page. Column stays in DB (no migration needed) — just not surfaced.
- Events table: drop the time-of-day display from any list cells; show date only.

### 3. Attendee saving — diagnose + harden (`src/components/bd/AttendeesPicker.tsx`)
The schema, RLS, and mutation all look correct (unique key on `event_id,user_id`, upsert wired). Most likely the call is failing silently or you're looking at a stale cache. Fix in one pass:
- Add an `onError` toast to `useAddEventAttendee` / Update / Remove so any RLS or constraint failure becomes visible instead of swallowing.
- After `addAtt.mutate(...)`, await `mutateAsync` and force `qc.invalidateQueries` + refetch before clearing the picker (doctrine: await invalidation before UI transition).
- Verify the picker is actually mounted inside the **Edit dialog** in `BdEvents.tsx` (you said attendee section was wired there) — if it's still using a stub Select, swap to `<AttendeesPicker eventId={...} />`.

If after these changes saving still fails, the toast will tell us why (RLS vs FK vs network) and I'll patch from there.

### 4. Chat thread identity + @mentions (`src/components/bd/BdActivityThread.tsx`)
Two problems to fix together:
- **"Can't tell it was me"**: bubbles already split by author, but the author name only shows for others. Always show a small name + timestamp header on every bubble (yours and theirs), and label your own bubble "You" so the audit trail reads cleanly in screenshots.
- **Can't tag teammates**: add `@` autocomplete in the composer.
  - Trigger on `@`, query `useCompanyProfiles()`, render a popover with name list, insert as `@[Name](profile_id)` token.
  - Store mentions in a new `mentioned_user_ids uuid[]` column on `bd_activities` (migration).
  - On insert, create a row in `notifications` for each mentioned user (type `bd_mention`, link back to the lead/event). They get the existing notification bell ping + an entry in their notification panel — that's how "they know to look."
  - Render mentions as a styled chip inline; clicking jumps to that teammate's profile.

### 5. AI-suggested new-event flow (proposed UX)
When the "scout-events" pipeline finds a relevant event:
1. Insert it into `bd_events` with `status='SUGGESTED'` and `suggested_by_ai=true` (boolean column).
2. Fire a notification to all BD-role users: "AI found a new event — NYC Real Estate Summit (Jun 24). Worth attending?" deep-linking to the event detail.
3. On the event detail, if `status='SUGGESTED'`, show a banner at the top with **Why AI flagged this** (already populated via `why_it_matters`) + two buttons: **Add to pipeline** (flips status to `PLANNED`) and **Dismiss** (status `DISMISSED`, hides from default list).
4. The existing `BdActivityThread` on the event becomes the discussion surface — the AI auto-posts a system `NOTE` with its reasoning as the first message, teammates can `@mention` each other in-thread to weigh in, and once someone Adds-to-pipeline the thread carries forward.

No separate "AI inbox" needed — reuses existing notification + event-detail surfaces.

### Files touched
- `src/pages/bd/_bdcard/BdMyCardTab.tsx` (remove Print, shrink vCard)
- `src/pages/bd/BdEventDetail.tsx` (single date, drop next_action)
- `src/pages/bd/BdEvents.tsx` (date-only cells, verify AttendeesPicker in dialog)
- `src/hooks/useBdEvents.ts` (error toasts on attendee mutations)
- `src/components/bd/BdActivityThread.tsx` (always-on author header, @mention composer + chip render)
- New: `@mentions` popover component
- Migration: `bd_activities.mentioned_user_ids uuid[]`, `bd_events.status` enum extend with `SUGGESTED`/`DISMISSED`, `bd_events.suggested_by_ai bool`
- Edge function `scout-events` (if exists) updated to insert with new flags + dispatch notifications

### Questions before I build
1. **AI-suggested events** — is the proposed flow above what you want, or would you rather see a dedicated "Suggestions" inbox separate from the events list?
2. **@mentions notification channel** — in-app bell only, or also email the tagged person?
3. **Attendees bug** — when you try to add a teammate now, what happens exactly? Dropdown empty? Click does nothing? Row appears then vanishes on refresh? (helps me confirm the toast-driven diagnosis above will catch it)