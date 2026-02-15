

# RFP Discovery Module -- Phase 1 Implementation

## Summary

Add an automated RFP Discovery system as a core sub-module of the existing RFPs section. This includes three new database tables, a monitoring edge function powered by Lovable AI, a full discovery dashboard UI, monitoring settings, and a bridge that converts discovered leads into the existing RFP response builder workflow.

Additionally, add a **Design Theme** setting in Company Settings so each company can upload their logo and set brand colors, which the RFP preview/export will inherit.

---

## 1. Database Migration

### New Tables

**rfp_sources** -- Procurement portals to monitor
- id (uuid PK), company_id (FK companies), source_name, source_url, source_type (rss/api/html), check_frequency (daily/twice_daily), last_checked_at, active, created_at
- Seed default rows: NYC PASSPort, NYC EDC, NYCHA Solicitations, NYS Contract Reporter

**discovered_rfps** -- RFPs found by the system
- id (uuid PK), company_id (FK companies), source_id (FK rfp_sources), title, rfp_number, issuing_agency, due_date, original_url, pdf_url, discovered_at, relevance_score (numeric 0-100), relevance_reason (text), service_tags (text[]), estimated_value (numeric), status (text default 'new': new/reviewing/preparing/passed/archived), assigned_to (FK profiles nullable), notes, rfp_id (FK rfps nullable -- linked when response is generated), created_at, updated_at

**rfp_monitoring_rules** -- Company-specific matching criteria
- id (uuid PK), company_id (FK companies), keyword_include (text[]), keyword_exclude (text[]), agencies_include (text[]), min_relevance_score (integer default 60), notify_email (boolean default true), email_recipients (text[]), active (boolean default true), created_at

### Table Alterations

**rfps** -- Add column:
- `discovered_from_id` (uuid FK discovered_rfps, nullable) -- tracks origin

### RLS Policies

All three tables get standard company-scoped RLS using the existing `get_user_company_id()` helper, matching the pattern used on `rfps`, `rfp_content`, etc.

---

## 2. Edge Function: `monitor-rfps`

A non-streaming edge function that:

1. Accepts `{ company_id }` in the request body (or derives from auth)
2. Fetches all active `rfp_sources` for the company
3. For each source, fetches the URL and extracts listing data (title, agency, due date, link)
4. Deduplicates against existing `discovered_rfps` by `original_url` or `rfp_number`
5. For each new listing, calls Lovable AI (`google/gemini-3-flash-preview`) with the company's services/keywords from `rfp_monitoring_rules` to score relevance (0-100) and extract tags
6. Inserts qualifying results (above min_relevance_score) into `discovered_rfps`
7. Returns a summary: `{ new_count, total_scanned, sources_checked }`

Handles 429/402 errors from AI gateway gracefully. Config: `verify_jwt = false`.

---

## 3. Frontend Changes

### 3a. RFPs Page Update (`src/pages/Rfps.tsx`)

Add a "Discover" button in the header toolbar (next to Content Library and New RFP buttons) that navigates to `/rfps/discover`.

### 3b. New Page: RFP Discovery (`src/pages/RfpDiscovery.tsx`)

Route: `/rfps/discover`

Layout (inside AppLayout):
- **Header**: Back arrow to /rfps, title "RFP Discovery", subtitle with source count and last-checked time, and a "Scan Now" button (triggers edge function manually)
- **Summary bar**: Three stat cards -- New (count), Reviewing (count), Total Discovered
- **Filters**: Agency dropdown, min relevance score slider, status tabs (New / Reviewing / Preparing / Passed)
- **Discovery list**: Cards for each discovered RFP showing:
  - Relevance score badge (color-coded: green above 80, amber 60-80, red below 60)
  - Title, agency, due date with days-remaining countdown
  - Service tags as small badges
  - Estimated value if present
  - AI relevance reasoning (truncated, expandable)
  - Three action buttons: "Review" (opens detail sheet), "Generate Response" (creates RFP record and opens builder), "Pass" (marks as passed)

### 3c. Discovery Detail Sheet (`src/components/rfps/DiscoveryDetailSheet.tsx`)

A Sheet (side panel) showing:
- Full metadata: title, agency, RFP number, due date, source, original URL link
- AI analysis: relevance score, reasoning, service tags
- Assignment dropdown (team members)
- Notes textarea
- Status selector
- "Generate Response" button: creates a new `rfps` record pre-filled with discovered data, sets `discovered_from_id`, and opens the RFP Builder dialog
- "View Original" link to the source URL

### 3d. Monitoring Settings Dialog (`src/components/rfps/MonitoringSettingsDialog.tsx`)

Accessible via gear icon on the Discovery page header:
- **Sources**: Toggle each rfp_source on/off, shows last checked time
- **Keywords**: Tag-style input for include and exclude keywords
- **Agencies**: Checkbox list for agency filters
- **Relevance threshold**: Slider (0-100, default 60)
- **Notifications**: Email toggle + recipients input
- Save button

### 3e. Hook: `src/hooks/useDiscoveredRfps.ts`

Standard React Query hook following existing patterns:
- `useDiscoveredRfps()` -- list with filters
- `useUpdateDiscoveredRfp()` -- status changes, assignment, notes
- `useRfpSources()` -- list sources
- `useRfpMonitoringRules()` -- CRUD for rules
- `useTriggerRfpScan()` -- mutation calling the edge function

### 3f. Design Theme Setting

Add a "Brand Theme" card inside **Company Settings** (`src/components/settings/CompanySettings.tsx`):
- Logo upload (uses existing Supabase storage)
- Primary color picker
- Accent color picker
- Saved to a new `theme` JSONB column on the `companies` table

The RFP Preview Modal will read these values to style headers, accents, and logo placement, making every company's output match their brand without hardcoding GLE's colors.

---

## 4. Routing and Navigation

### App.tsx
Add route: `/rfps/discover` pointing to `RfpDiscovery` (protected)

### Sidebar
No new top-level nav item needed -- Discovery is accessed from within the RFPs section via the "Discover" button, keeping navigation clean.

---

## 5. File Summary

| Action | File |
|--------|------|
| Migration | New tables: rfp_sources, discovered_rfps, rfp_monitoring_rules; alter rfps, companies |
| Create | `supabase/functions/monitor-rfps/index.ts` |
| Create | `src/pages/RfpDiscovery.tsx` |
| Create | `src/hooks/useDiscoveredRfps.ts` |
| Create | `src/components/rfps/DiscoveryDetailSheet.tsx` |
| Create | `src/components/rfps/MonitoringSettingsDialog.tsx` |
| Modify | `src/App.tsx` (add route) |
| Modify | `src/pages/Rfps.tsx` (add Discover button) |
| Modify | `src/components/settings/CompanySettings.tsx` (add Brand Theme card) |
| Modify | `src/components/rfps/RfpPreviewModal.tsx` (read company theme) |
| Modify | `supabase/config.toml` (add monitor-rfps function config) |

---

## 6. Roadmap Note

This plan covers **Phase 1** (foundation). Future phases on the roadmap include:
- **Phase 2**: Richer AI extraction (download and parse full RFP PDFs from source links)
- **Phase 3**: Additional sources (SAM.gov federal, Empire State Development)
- **Phase 4**: Won-RFP conversion flow (auto-create client, project, and retainer invoice)
- **Phase 5**: Analytics dashboard (win rate by agency, average response time, content effectiveness)

These are tracked as roadmap items, not built in this iteration.

