

## DOB NOW Filing Agent — What Ordino (Lovable) Needs to Build

The architecture is clear: Ordino is the **data source and UI**, while a separate Python service (Claude Agent SDK + Playwright MCP) handles the actual browser automation on DOB NOW. Here's what we build inside Lovable to support that flow.

### Architecture

```text
┌─────────────────────────────────┐        ┌─────────────────────────────┐
│  ORDINO (Lovable)               │        │  Agent Service (External)   │
│                                 │        │  Python + Claude Agent SDK  │
│  Filing Prep Sheet UI           │        │  + Playwright MCP           │
│    └─ "Launch Agent" button     │        │                             │
│                                 │  HTTP  │  1. Fetches payload from    │
│  Edge Function: filing-payload  │◄───────│     /filing-payload         │
│    → project, property, PIS,    │        │  2. Opens DOB NOW           │
│      contacts, services data    │        │  3. Reads page via MCP      │
│                                 │        │  4. Fills forms             │
│  Edge Function: filing-status   │◄───────│  5. POSTs status updates    │
│    → receives progress updates  │        │     to /filing-status       │
│    → writes to filing_runs      │        │                             │
│                                 │        │                             │
│  UI: live progress feed         │        │                             │
│    → polls/subscribes to        │        │                             │
│      filing_runs table          │        │                             │
└─────────────────────────────────┘        └─────────────────────────────┘
```

### What We Build (4 pieces)

**1. Database: `filing_runs` table**
- `id`, `company_id`, `project_id`, `service_id`, `status` (queued/running/completed/failed/review_needed), `progress_log` (jsonb array of step messages), `payload_snapshot` (jsonb), `agent_session_id`, `started_at`, `completed_at`, `error_message`, `created_by`
- Enable realtime so the UI can subscribe to progress updates
- RLS: company-scoped read/write for internal users, plus a policy for the agent service to write via service role key

**2. Edge Function: `filing-payload`**
- Authenticated endpoint (JWT or service-role key for the agent)
- Accepts `project_id` + `service_id`
- Returns a structured JSON payload organized by DOB NOW form sections:
  - **Location**: address, borough, block, lot, BIN (from `properties`)
  - **Applicant/Owner**: names, license info, addresses (from project contacts + PIS responses)
  - **Filing Details**: work types, job description, filing type, estimated cost, square footage (from `services` + PIS)
  - **Stakeholders**: GC, architect, SIA, TPP (from `projects` fields synced by PIS)
- Reuses the same data-gathering logic already in `DobNowFilingPrepSheet.tsx` but server-side

**3. Edge Function: `filing-status`**
- Accepts POSTs from the agent service (authenticated via a shared secret or service role key)
- Writes progress updates to `filing_runs` table: `{ step: "Filling Borough field", status: "success", timestamp }`
- Handles terminal states: completed, failed, review_needed

**4. UI Updates to `DobNowFilingPrepSheet.tsx`**
- Add "Launch Agent" button (next to existing "Confirm & Open DOB NOW")
- Creates a `filing_runs` record with status `queued` and the payload snapshot
- Subscribes to realtime changes on that row
- Shows a live progress feed: step-by-step messages as they arrive
- Final state shows success confirmation or error with retry option
- Agent service URL configured via a secret (`DOB_AGENT_URL`)

### What the External Agent Service Does (not built in Lovable)
- Python service using Claude Agent SDK
- Calls `GET /filing-payload?project_id=X&service_id=Y` to get structured data
- Uses Playwright MCP to open DOB NOW, read forms, fill fields
- Posts progress updates to `POST /filing-status` as it works
- Handles dynamic form logic (work type changes available fields, borough affects BIN lookup)

### Implementation Order
1. Create `filing_runs` table + realtime
2. Build `filing-payload` edge function
3. Build `filing-status` edge function
4. Update Filing Prep Sheet UI with agent launcher + progress feed

