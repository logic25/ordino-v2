

## DOB NOW Filing Agent — Implementation Complete

### What was built (4 pieces):

**1. Database: `filing_runs` table** ✅
- Table with `id`, `company_id`, `project_id`, `service_id`, `status`, `progress_log` (jsonb), `payload_snapshot`, `agent_session_id`, timestamps, `error_message`, `created_by`
- RLS: company-scoped read/insert/update for authenticated users
- Realtime enabled for live progress subscriptions
- `updated_at` trigger

**2. Edge Function: `filing-payload`** ✅
- Accepts `project_id` + optional `service_id` via query params
- Dual auth: JWT for browser, service-role key for agent
- Returns structured JSON: `location`, `applicant_owner`, `filing_details`, `stakeholders`, `contacts`
- Pulls from projects, properties, PIS responses, contacts, services

**3. Edge Function: `filing-status`** ✅
- POST endpoint for agent to report progress
- Auth: service-role key, `x-agent-secret` header, or JWT
- Appends to `progress_log` array, updates `status`, sets `started_at`/`completed_at`

**4. UI: Agent Launcher in DobNowFilingPrepSheet** ✅
- "Launch Filing Agent" button alongside existing manual submit
- Creates `filing_runs` record with `queued` status + payload snapshot
- Realtime subscription shows live progress feed
- Status indicators: queued → running → completed/failed/review_needed
- Progress log with timestamped steps and status icons
- Retry/Done actions on terminal states

### External agent service (not built here):
- Python + Claude Agent SDK + Playwright MCP
- GET `/filing-payload?project_id=X&service_id=Y` with service-role key
- POST `/filing-status` with `{ filing_run_id, status, step, error_message, agent_session_id }`
- `DOB_AGENT_SECRET` header auth supported
