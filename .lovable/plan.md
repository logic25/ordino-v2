## Ordino Client Portal — Phase 1 (revised)

Confirmed: invite-only signup, `/portal/*` sub-route, no admin UI this phase (data edits via SQL). Four amendments from your feedback folded in below, plus a direct answer on auto-status.

---

### On auto-updating filing status (question 4)

**Answer: automatic, with a manual override lane.** Doing it any other way defeats the portal's point — clients will spot stale data instantly and go back to calling GLE.

Mechanism in Phase 1:
- A `portal-filing-sync` edge function runs on a cron (every 30 min) and reconciles each `filings` row against Ordino's existing internal sources of truth:
  - `dob_applications.status` (already tracked in Ordino)
  - `filing_runs` outcomes (filing agent completions)
  - NYC Open Data DOB Job Filings / DOB NOW Build (via existing lookup patterns in `useNYCPropertyLookup` / `useDOBApplications`)
- Mapper translates internal Ordino statuses → the seven client-facing stages (Pre-filing → Filed → In Review → Objections → Approved → Permit Issued → Sign-off).
- On stage change: insert `filing_events` row (drives timeline + activity feed) and enqueue notifications.
- Manual override: GLE staff can force a stage via SQL (Phase 1) or admin UI (later); manual entries write `filing_events.source = 'manual'` so the automated sync won't clobber them without a newer signal.
- `blocked` flag (see below) is separate from stage — set by either the sync (e.g., objections detected) or manually.

Honest limit: NYC Open Data lags BIS by hours-to-days for some datasets (documented gotcha in the codebase). For filings not yet in Open Data, the portal reflects whatever Ordino's internal record says. This is a known ceiling, not a bug — Phase 1 ships with it and we tighten later if you add a BIS scraper.

---

### Amendments to the schema

**1. Buildings + rollup view**
- New `buildings` table: id, client_org_id, address, bin (nullable), pm_name, pm_email, notes
- `projects` gains nullable `building_id`
- Portfolio UI: if the current client org has any `buildings` rows → **Rollup view** (buildings as top-level cards showing project count, aggregate status pills, PM name; click through to a building detail showing its projects). Orgs with no buildings → the flat project grid from the original plan. Detected automatically, no user toggle.

**2. Blocked flag on filings (co-exists with stage)**
- `filings` gains: `blocked` (bool, default false), `blocked_reason` (text), `blocked_since` (timestamptz)
- Rendered as a red "Blocked" badge on the filing row, independent of the stage pill. Blocked filings surface at the top of the project detail and get their own portfolio counter ("Blocked filings").
- Setting `blocked=true` triggers a notification (see below).

**3. Email notifications in Phase 1**
- Triggers: filing becomes `blocked`, enters `objections`, `approved`, or `permit_issued`; new client-owned action item.
- Delivery: Lovable's built-in email infrastructure. Requires the email-domain setup dialog on first run (prerequisite; I'll surface it), then `setup_email_infra` + `scaffold_transactional_email`.
- Templates (React Email .tsx, brand-matched, calm B2B):
  - `filing-blocked`
  - `filing-status-changed` (parameterized for objections/approved/permit_issued)
  - `client-action-required`
- Send trigger: DB trigger on `filing_events` insert (and on `client_action_items` insert where `owner='client'`) enqueues via `send-transactional-email` with an idempotency key = `${filing_id}:${stage}` so the sync re-running never double-sends.
- Recipients: all users in the `client_org` (via `client_org_memberships`). Suppression list respected automatically.
- Per-user preferences deferred to Phase 2 (send-all-triggers on by default).

**4. No other in-app notification changes** — bell icon + `/portal/notifications` list still there.

---

### Revised final scope

**Data model (new tables/columns, all with RLS + explicit GRANTs)**
- `client_orgs`, `client_org_memberships`, `buildings` (new)
- `portal_projects_link` extension of existing `projects` via nullable `client_org_id` + `building_id` columns added directly to `projects` (simpler than a link table — projects are already the canonical entity; nullable keeps existing internal projects untouched)
- `filings` (with `blocked`, `blocked_reason`, `blocked_since`)
- `filing_events` (with `source` enum: `auto` | `manual`)
- `client_action_items`
- `portal_documents` (+ `portal-documents` private storage bucket)
- `portal_notifications`
- `profiles.portal_role` (nullable)

**Screens**
- `/portal` — Rollup view (if buildings exist) OR flat grid; counters include Blocked
- `/portal/buildings/:id` — building detail with its projects (only when buildings exist)
- `/portal/projects/:id` — header, tabs: Timeline (per-discipline, with Blocked badges) · Action Items · Documents · Activity
- `/portal/notifications`

**Backend**
- `portal-filing-sync` edge function + pg_cron every 30 min
- Status mapper (internal Ordino → 7 client-facing stages)
- Notification DB triggers on `filing_events` and `client_action_items`
- Email templates via Lovable's email infrastructure

**Auth**
- Invite-only. GLE staff creates auth users + `client_org_memberships` rows via SQL this phase. `portal_role` set on profile. Client users land on `/portal` after login; internal users can still reach `/dashboard`.

**Seed**
- 3 client orgs: one national brand *with buildings* (demonstrates rollup), one GC *without buildings* (demonstrates flat grid), one design firm with a single small project. Mix of stages including one Blocked filing and one in Objections with a client-owned action item.

---

### Out of scope (unchanged)
Plan ingestion, CitiSignal/BinCheck, admin CRUD UI, per-user notification preferences, BIS scraper.

### Open items (none blocking — I'll pick sensible defaults)
- Exact stage-mapping table from Ordino internal statuses → 7 client-facing stages: I'll draft it during build using `dob_applications.status` values already in the DB and confirm with you in the PR/preview.

Ready to build on approval.
