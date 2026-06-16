
# BD Comp & Scorecard

Adds a compensation + scorecard layer over the existing BD pipeline (events, leads, invoices). Reuses CaptureLeadModal, scan-business-card, auth, uploaders, toasts, and existing report/PMDailyView/Ask Ordino patterns. No new metrics service, no new scanner.

## 1. Schema (one migration)

**Columns**
- `leads.intro_sent_at timestamptz`
- `profiles.is_comp_admin boolean default false` (seed `true` for Manny Russell + Chris Henry by name/email match in same migration)

**Tables** (all with company_id, created_at, updated_at, RLS, GRANTs)
- `bd_comp_plans` — `person_id uuid (profiles.id)`, `base_salary numeric`, `event_bonus_amount numeric default 250`, `new_client_bonus_amount numeric default 1000`, `small_contract_pct numeric default 50`, `small_contract_threshold numeric default 2000`, `revenue_bonus_pct numeric default 2`, `revenue_window_months int default 12`, `active boolean default true`. Unique `(company_id, person_id)`.
- `bd_bonus_ledger` — `person_id uuid`, `type text check in ('EVENT','NEW_CLIENT','REVENUE')`, `source_ref jsonb` (event_id / lead_id / invoice_id / proposal_id), `amount numeric`, `status text check in ('ACCRUED','APPROVED','PAID') default 'ACCRUED'`, `accrued_at timestamptz default now()`, `due_at timestamptz`, `paid_at timestamptz`, `approved_by uuid`, `notes text`.
- `bd_goals` — `person_id uuid`, `period_start date`, `period_end date`, `event_id uuid null`, `metric text` (e.g. `contacts`, `intros`, `qualified`), `target int`.

**RLS** for `bd_comp_plans` + `bd_bonus_ledger`: SELECT/UPDATE only when `person_id = (profiles where user_id=auth.uid())` OR caller `is_comp_admin`. INSERT for comp-admins only (ledger also writable by trigger via SECURITY DEFINER).

**Helper function** `public.is_comp_admin()` returns boolean (reads `profiles.is_comp_admin` for `auth.uid()`).

**Triggers** (SECURITY DEFINER, accrue to ledger — idempotent via unique partial indexes on `source_ref`):
- After `leads.stage` → `QUALIFIED` AND `bd_sourced=true` AND `event_id` set → insert EVENT bonus (`event_bonus_amount`) for the lead's owner (assigned_to) once per `(person, event_id, lead_id)`.
- After `proposals.status` → `executed` where originating lead `bd_sourced=true` and client is new (no prior executed proposal for that client) → NEW_CLIENT bonus: full `new_client_bonus_amount` if `total >= small_contract_threshold` else `small_contract_pct%` of total.
- REVENUE accrual is computed on read (projected from PAID invoices in window) — only materialized to ledger when comp-admin clicks Approve.

**Notification** trigger: on `leads` insert where `bd_sourced=true` → notify all comp-admins.

## 2. Frontend

**Lead detail**
- "Mark intro sent" button (LeadOutreachCard) → sets `intro_sent_at=now()` and if `stage='NEW'` → `'CONTACTED'`. Uses existing `useUpdateLead` + sonner toast.

**BD Scorecard** — `src/pages/bd/BdScorecard.tsx`, accessible from existing BD nav
- Person picker (defaults to self; comp-admins see all)
- Cards (reuses existing report card components from `src/components/reports/`):
  - Events attended (count from `bd_event_attendees`)
  - Contacts captured (leads created where `created_by = person` in range)
  - Speed-to-first-touch (avg `intro_sent_at - created_at` hours)
  - Leads by stage (bar/list)
  - Pipeline $ (sum `expected_value` where stage in NEW/CONTACTED/QUALIFIED)
  - Funnel: scans → qualified → won %

**Profile → "My Earnings" tab** (gated to self + comp-admin)
- Period selector (month / quarter / YTD)
- Three rows: Event bonuses, New-client bonuses, Projected revenue bonus (computed: 2% of PAID invoices within window for clients originating from this person's BD-sourced leads)
- Ledger table (accrued/approved/paid)
- **Never** renders `base_salary`

**Admin "BD Comp" page** (`/settings/bd-comp`, comp-admins only)
- Roster table: each person's accrued / approved / paid totals
- Row actions: **Approve** (ACCRUED→APPROVED), **Mark Paid** (sets `paid_at`)
- Edit plan inline (base, event, client, pct, threshold, revenue pct, window)

## 3. Existing surfaces (extend, don't replace)

- **PMDailyView / morning briefing**: add two existing-card-style rows — "Open follow-ups" (count of `leads.next_follow_up_at <= today` for viewer) and "BD-sourced this period" (count of viewer's `bd_sourced=true` leads this month).
- **Reports page**: add "BD Sourced — last 90 days" card (count, conversion-to-QUALIFIED %, $ in active proposals). Uses existing report card pattern, single Supabase query.
- **Ask Ordino prompt builder**: when caller `is_comp_admin` and intent matches "how is BD going / BD update / BD report", inject a context block: events this month, BD-sourced count + conversion, open follow-ups by person, top 3 scanners (by `contacts captured`), and `SUM(amount) WHERE status='ACCRUED'` from `bd_bonus_ledger`.

## 4. Seed

Insert `bd_comp_plans` row for Natalia: base 92500, event 250, client 1000, small_pct 50, threshold 2000, revenue 2%, window 12 (matched by profile name in seed data step).

## Technical notes

- Hooks: `useBdCompPlans`, `useBdBonusLedger`, `useBdScorecard`, `useBdComp` (admin actions). All follow existing `useLeads.ts` shape.
- All bonus math centralized in `src/lib/bdComp.ts` (pure functions, unit-tested).
- Idempotency: unique partial indexes on `bd_bonus_ledger(person_id, type, (source_ref->>'lead_id'))` and same for `proposal_id`.
- No new toast / uploader / auth wiring. No new edge functions (everything via RPC/triggers + client queries).

## Out of scope (explicit)
BD homepage, new lead capture UI, new scanner, Slack/QBO/Stripe, ML scoring, uploader changes.
