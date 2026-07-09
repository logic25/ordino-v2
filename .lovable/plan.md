
# Portal plan — final, incorporating what already exists

## What's already built (keeping as-is)
- Portfolio page with counters (Active / Permits Issued / Blocked / Actions Owed)
- Card grid per project with stage pill, % complete, next action
- Building rollup when multiple projects share a building
- Search + stage filter, per-project detail pages, notifications, invite-client flow
- Applies automatically to every client with a portfolio via `client_org_memberships`

## What's actually new

### 1. Portfolio: add a "Tracker" view toggle next to Cards
One extra button on the portfolio page → renders a flat filing-level sheet mirroring Natalia's Rudin workbook.

```
Portfolio                             [ Cards | Tracker ]  [Export CSV]
──────────────────────────────────────────────────────────────────────
Signed  Address        Project      Tenant  App #        Contractor  SIA       DOB Status         Callout
```

- One row per filing (service), grouped visually by property
- Sort/filter per column, CSV export
- Same underlying data + RLS as Cards — every client with a portfolio gets it automatically
- Columns pulled from existing data:
  - Signed → `proposals.signed_at` on the linked proposal
  - Address → `properties.address`
  - Project → `projects.name`
  - Tenant → `projects.tenant_name`
  - App # → `services.job_number` (+ filing_type suffix for PAAs)
  - Contractor → `project_contacts` where role = `gc`
  - SIA → `project_contacts` where role = `sia`
  - DOB Status → derived from service timestamps (see #4)
  - Callout → most recent client-visible service-level note (see #3)
- **Building PM column:** optional. New `building_pm` role on `project_contacts`. Column auto-hides for any org whose contacts include zero `building_pm` entries. Rudin fills it; others ignore it; no forced friction.

### 2. Per-project Filings tab (kill the broken 6-lane DisciplineTimeline)
Same data as the tracker, scoped to one project, grouped by parent App # with PAAs nested:

| App # | Type | Work Type | Status | Last Update |
|---|---|---|---|---|
| 1234567 | New Job | PL | Permit Issued | 3d ago |
| 1234567-I1 | PAA | PL | In Review | 1d ago |

### 3. Callout = client-visible project note, per service
Reuse `project_notes`. Two additions:
- `project_notes.client_visible boolean default false`
- `project_notes.service_id uuid null` (so notes can attach to a filing, not just a project)

PM workflow: type a note (already do), tick "Show to client," optionally tag which service. Tracker column pulls the most recent `client_visible = true` note per service. Zero new writing habit.

### 4. Auto-status from job # + DOB sync
Two DB triggers turn the one PM habit (paste job #) into everything downstream:

- **`services_stamp_filed_on_job_number`** — when `services.job_number` is set, stamp `filed_at = now()` (if null), write `service_filed` to `project_timeline_events`, write `portal_notifications` row.
- **`dob_sync_stamp_service_dates`** — on `dob_applications` upsert, match `job_number` to `services`; stamp `objections_received_at / approved_date / permit_issued_date` from DOB data; log timeline event + notification per new stamp. For PAAs, upsert the child `services` row (linked via `parent_service_id`) and log `paa_filed` / `paa_approved`.

DOB Status column in the tracker derives from those timestamps → Filed → In Review → Objections → Approved → Permit Issued.

### 5. Action Items tab → answers "Need anything?"
Reuse `project_action_items`:
- Add `owner_facing boolean default false`
- Portal shows only owner-facing open/in-progress/blocked rows
- Submit dialog: client uploads file(s) to `portal_documents`, appends `action_item_comments` row, sets status → done, logs `client_submitted_item` to timeline
- Ordino's `CreateActionItemDialog` gets a "Show to client" checkbox (default off — safe)

### 6. Timeline/Activity tab → repoint to `project_timeline_events`
Same table Ordino's `TimelineFull.tsx` already renders. Portal filters to client-visible types: `service_filed`, `objections_received`, `service_approved`, `permit_issued`, `paa_filed`, `paa_approved`, `document_uploaded`, `client_submitted_item`, `action_item_created` (owner-facing only), `invoice_sent`.

### 7. Notifications
Same triggers that write timeline events also write `portal_notifications`. Existing bell/notifications page just works.

---

## Technical summary

**Migration:**
- `project_action_items.owner_facing boolean default false`
- `services.filing_type text` (`new_job` | `paa`) + `services.parent_service_id uuid`
- `project_notes.client_visible boolean default false` + `project_notes.service_id uuid null`
- Add `building_pm` and confirm `sia`, `gc` roles in the `project_contacts` role enum/constraint
- Triggers: `services_stamp_filed_on_job_number`, `dob_sync_stamp_service_dates`, `portal_documents_log_event`, `action_items_log_client_events`
- Extend `project_timeline_events.event_type` allowlist for new types

**Ordino UI (minimal touches):**
- `CreateActionItemDialog` — "Show to client" checkbox
- Note editor — "Show to client" checkbox + optional service selector
- Contact role dropdown — add "Building PM" option

**Portal UI:**
- `Portfolio.tsx` — add `[Cards | Tracker]` toggle + `PortfolioTracker` component + CSV export
- New `FilingsTable` per-project component (grouped by parent job #, PAAs nested)
- Replace `DisciplineTimeline` usage with `FilingsTable`
- Activity tab repointed to `project_timeline_events`
- Action Items tab reads `owner_facing = true`; add Submit dialog

---

## What still requires PMs
1. Paste job # into Service row (already happens)
2. Tick "Show to client" on notes the client should see (default off)
3. Tick "Show to client" on action items intended for the client (default off)

Nothing else changes.

---

## Ship order
1. **Tracker view + Filings tab + PAA grouping + job#/DOB triggers** — replaces Natalia's spreadsheet
2. **Notes `client_visible` + Callout column wiring**
3. **Timeline repoint + document/action-item event triggers**
4. **Action Items owner_facing + portal Submit flow**
5. **Optional: stage-change transactional emails**

Approve all-in-one, or tell me which phase to start with.
