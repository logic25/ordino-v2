# Ordino

**Ordino is a mobile-first, AI-powered, multi-tenant SaaS for NYC permit expediting and construction-compliance firms.** It's the V2 clean rebuild of Green Light Expediting's permit-tracking platform — replacing a legacy single-tenant Laravel system — designed so project managers actually *use* it: capture billable time naturally, eliminate double data entry, let AI handle the grunt work (follow-ups, summaries, reports, objection responses), and work from a phone.

> See [`docs/spec.md`](docs/spec.md) and [`docs/constitution.md`](docs/constitution.md) for the product vision, success metrics, and non-negotiable principles.

---

## Tech stack

- **Frontend:** Vite + React 18 + TypeScript, [shadcn/ui](https://ui.shadcn.com) (Radix) + Tailwind CSS, React Router, TanStack Query (server state) + TanStack Table (data grids)
- **Backend:** [Supabase](https://supabase.com) — Postgres (with RLS), Auth, Storage, and **Deno edge functions** (~67 of them)
- **AI:** Lovable AI Gateway (OpenAI/Google models) for summaries, the Beacon Q&A assistant, RFP extraction, payment-risk prediction, etc.
- **Tooling:** ESLint, Vitest (+ Testing Library), Sentry for error monitoring
- **Hosting / sync:** built and deployed via [Lovable](https://lovable.dev); changes pushed to this repo sync both ways

Rough size: ~35 pages, ~110 hooks, ~67 edge functions, 250+ migrations.

---

## Architecture

```
React SPA (src/)
   │  TanStack Query
   ▼
Supabase
   ├── Postgres  ── RLS scoped by company_id via public.is_company_member()
   ├── Auth      ── profiles table (profiles.user_id = auth.uid())
   ├── Storage   ── documents, attachments
   └── Edge fns (supabase/functions/) ── AI, Gmail/Google/Chat sync, filing, billing, webhooks
```

- **Multi-tenant:** every domain table carries `company_id` (the tenant = an expediting firm) and is protected by RLS using the `is_company_member()` helper. A `profiles` row links an auth user to their company; most FKs (`assigned_to`, `created_by`, …) reference `profiles.id`, **not** `auth.uid()`.
- **⚠️ Naming gotcha:** the UI **"Companies"** section is the **`clients`** table (customers/partners). The **`companies`** table is the *tenant*. See [`docs/data-model-naming.md`](docs/data-model-naming.md).

---

## Feature areas

| Area | Route | What it does |
|---|---|---|
| **Dashboard** | `/dashboard` | Role-based home (PM / manager / admin / accounting) with KPIs |
| **Projects** | `/projects` | DOB permit projects — phases, readiness checklist, PIS, services, change orders, documents, timeline |
| **Properties** | `/properties` | NYC properties (address, BIN, block/lot) |
| **Time** | `/time` | Billable time logging |
| **Proposals** | `/proposals` | Client proposals → e-sign → convert to project; also hosts the legacy Leads table |
| **BD (Business Development)** | `/bd/leads`, `/bd/events`, `/bd/sequences` | Leads workspace (Airtable-style grid, capture modal, activity thread, lead→Company conversion), events, outreach sequences |
| **Billing & Invoices** | `/invoices` | Billing schedules, invoices, deposits, collections |
| **Email** | `/emails` | **Gmail-backed** client — compose/reply/send, drafts, scheduled send, search, attachments, tag-to-project, reminders/snooze (**requires a connected Gmail account**) |
| **Calendar** | `/calendar` | Google Calendar sync |
| **Chat** | `/chat` | Google Chat integration |
| **Companies** | `/clients` | Customer/partner organizations (`clients`) + contacts |
| **RFPs** | `/rfps` | RFP discovery, library, partner responses, AI extraction |
| **Reports** | `/reports` | Project / billing / proposal analytics |
| **Documents** | `/documents` | Uploaded files |
| **Beacon** | (chat widget) | AI project Q&A assistant (tool-calling over an allowlisted schema slice) |

---

## AI & automation (edge functions)

A few of the ~67 functions in [`supabase/functions/`](supabase/functions):

- **`beacon-qa`** — the Beacon assistant: a JWT-authenticated tool-calling loop over an allowlisted schema slice; audit-logged to `beacon_tool_log`.
- **`summarize-project` / `auto-summarize-projects`** — AI status summaries. Pulls open checklist items, PIS gaps (from the latest RFI), recent activity, and the **last 30 days of project-tagged emails**, then writes a concise status note. (Note: Beacon does not automatically use this note — it queries live tables — so the two can read differently.)
- **`extract-rfp` / `monitor-rfps` / `rfp-partner-response`** — RFP intake & automation.
- **`predict-payment-risk` / `analyze-client-payments`** — billing/collections AI.
- **Gmail:** `gmail-auth`, `gmail-sync`, `gmail-send`, `gmail-search`, `gmail-attachments`.
- **Google:** `google-calendar-sync`, `google-chat-api`, `gchat-interaction`.
- **DOB filing:** `filing-agent-proxy`, `filing-payload`, `filing-status`, `citisignal-sync`.
- **Ops:** `sentry-webhook`, `triage-bug-report`, billing digests, scheduled emails/reminders, welcome emails.

---

## Integrations

- **Gmail** — the Email module is fully Gmail-powered (OAuth); there is no standalone mailbox.
- **Google Calendar** & **Google Chat**.
- **NYC DOB filing** — via the filing-agent / CitiSignal proxies.
- **Sentry** — error monitoring + bug triage.
- **Lovable AI Gateway** — LLM access for all AI features.

---

## Local development

Requirements: **Node.js** (18+) and **[bun](https://bun.sh)** (this repo is bun-managed — `bun.lock` is the source of truth; npm also works).

```sh
# 1. Install dependencies
bun install        # or: npm install

# 2. Configure environment — create .env with your Supabase project values:
#    VITE_SUPABASE_URL=...
#    VITE_SUPABASE_PROJECT_ID=...
#    VITE_SUPABASE_PUBLISHABLE_KEY=...

# 3. Run the dev server (http://localhost:5173)
bun run dev        # or: npm run dev
```

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `test` (Vitest), `test:watch`.

```sh
npm run build      # production build
npm run test       # unit tests (Vitest + Testing Library)
npm run lint       # ESLint
```

---

## Database & edge functions

- **Migrations** live in [`supabase/migrations/`](supabase/migrations) (timestamped SQL). They are applied to the remote Supabase project (the Lovable pipeline applies them on deploy); there is no committed local DB.
- **Generated types:** [`src/integrations/supabase/types.ts`](src/integrations/supabase/types.ts) — regenerated from the schema. When you add columns/tables in a migration, update these types to match.
- **RLS:** new per-tenant tables should `ENABLE ROW LEVEL SECURITY` and scope policies with `public.is_company_member(company_id)` (mirror an existing live table like `leads`).
- **Edge functions** are Deno; configured in [`supabase/config.toml`](supabase/config.toml) and deployed via the Supabase/Lovable pipeline. They read secrets from Supabase env (e.g. `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

---

## Repo layout

```
src/
  pages/            Route-level pages (Projects, Proposals, bd/, Emails, Clients, …)
  components/       Feature + shadcn/ui components (bd/, proposals/, projects/, emails/, ui/, layout/)
  hooks/            Data + domain hooks (useLeads, useProposals, useProjectDetail, useAuth, …)
  integrations/     supabase/ client + generated types
  lib/ · utils/ · services/   helpers
  test/             Vitest setup, mocks, unit tests
supabase/
  functions/        Deno edge functions (AI, Gmail/Google, filing, billing, webhooks)
  migrations/       Timestamped SQL migrations
docs/               spec.md, constitution.md, data-model-naming.md
```

---

## Built with Lovable

This project is developed on [Lovable](https://lovable.dev) — edits made there commit to this repo, and pushes here sync back. You can also work locally in your own IDE (above) or edit on GitHub directly. To deploy or connect a custom domain, use the Lovable project's **Share → Publish** and **Project → Settings → Domains**.
