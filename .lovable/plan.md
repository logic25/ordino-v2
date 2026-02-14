
# RFP Response Automation System

## Summary
Build an AI-powered RFP response system that lets users upload RFP PDFs, auto-extract requirements, generate response packages from a stored content library, review/edit sections, and track submission outcomes -- all integrated into the existing Ordino platform.

## Phased Approach

Given the scale of this feature (3 new database tables, new columns on `dob_applications`, 2 new edge functions, 10+ new components, 3 new routes), this will be built in **4 phases** to keep each deliverable testable.

---

### Phase 1: Database + Content Library (`/rfps/library`)
**Goal**: Create the data foundation and the content management UI.

**Database migrations**:
- Add columns to `dob_applications`: `notable`, `rfp_tags`, `reference_contact_name`, `reference_contact_title`, `reference_contact_email`, `reference_contact_phone`, `reference_notes`, `reference_last_verified` with GIN index on `rfp_tags`
- Create `rfp_content` table (id, company_id FK, content_type, title, content JSONB, tags, file_url, timestamps) with indexes
- Create `rfps` table (id, company_id FK, title, agency, rfp_number, due_date, status, uploaded_pdf_url, requirements JSONB, mwbe goals, response tracking fields, timestamps) with indexes
- Create `rfp_sections` table (id, rfp_id FK, section_type, content JSONB, ai_generated, reviewed, display_order, timestamps)
- RLS policies scoped to `company_id` using `get_user_company_id()` for all new tables
- Add `rfps` resource to `role_permissions` seed

**Frontend -- Content Library** (`/rfps/library`):
- New page with 6 tabs: Company Info, Staff Bios, Notable Projects, Narratives, Pricing, Certifications
- CRUD dialogs for each content type backed by `rfp_content` table
- Notable Projects tab: filtered view of `dob_applications` where `notable = true`, inline tag editor, contact fields
- Pricing tab: editable rate tables with multi-year escalation preview
- Narratives tab: rich text editor (Tiptap, already installed) with variable placeholders
- Certifications tab: list with file upload, expiration tracking

**New files**:
- `src/pages/RfpLibrary.tsx`
- `src/hooks/useRfpContent.ts`
- `src/components/rfps/ContentLibraryTabs.tsx` (and sub-components for each tab)
- Updated `ApplicationDialog.tsx` to include "RFP Reference Info" collapsible section

---

### Phase 2: RFP List + Upload + Parsing (`/rfps`)
**Goal**: Kanban board for tracking RFPs, PDF upload, AI-powered requirement extraction.

**Frontend -- RFP Kanban**:
- Kanban board with columns: Prospect, Drafting, Submitted, Won, Lost
- Cards showing title, RFP number, due date, agency, overdue warnings
- Drag-and-drop between columns (using native drag or a lightweight approach with state management)
- Confirmation modals for Won/Lost transitions
- Filters: agency, date range, status
- Search by title/RFP number

**Edge Function -- `parse-rfp`**:
- Accepts uploaded PDF text content
- Calls Lovable AI (google/gemini-3-flash-preview) with tool calling to extract structured data: title, agency, RFP number, due date, required forms, scope of work, selection criteria, M/WBE goals
- Returns structured JSON
- Handles rate limits (429) and payment errors (402)

**Frontend -- Upload Flow**:
- Upload modal with drag-and-drop zone
- PDF stored in backend file storage (`rfp-uploads` bucket)
- Loading state while AI parses
- Confirmation screen showing extracted requirements (editable)
- Save creates new `rfps` record

**New files**:
- `src/pages/Rfps.tsx`
- `src/hooks/useRfps.ts`
- `src/components/rfps/RfpKanbanBoard.tsx`
- `src/components/rfps/RfpCard.tsx`
- `src/components/rfps/UploadRfpDialog.tsx`
- `src/components/rfps/RfpStatusBadge.tsx`
- `supabase/functions/parse-rfp/index.ts`

---

### Phase 3: RFP Detail + AI Response Generation (`/rfps/:id`)
**Goal**: View extracted requirements, generate AI response sections, review/edit in a builder UI.

**Frontend -- RFP Detail Page** (4 tabs):
1. **Overview**: Uploaded PDF link, editable extracted requirements, required forms checklist, selection criteria visualization, M/WBE goal display
2. **Response Builder**: Section checklist, preview cards for each section (approach narrative, M/WBE narrative, staff bios, project experience, contractor info, pricing), edit/regenerate/mark-reviewed actions, reorderable sections
3. **Generated Files**: List of exported documents with download links
4. **Debrief** (visible when Won/Lost): Outcome form, contract value, notes, lessons learned tags

**Edge Function -- `generate-rfp-response`**:
- Fetches all relevant `rfp_content` for the company
- Selects notable projects using relevance scoring algorithm (agency match, service match, recency, verified contacts)
- Generates AI narratives via Lovable AI for: Approach Statement, M/WBE Narrative, Project Experience
- Structures non-AI sections (Contractor Info, Price Proposal, Staff Bios) from stored data
- Saves all sections to `rfp_sections` table
- Supports per-section regeneration with tone/length/emphasis parameters

**Edge Function -- `analyze-rfp-outcome`**:
- When RFP marked Won/Lost, analyzes debrief notes
- Returns 2-3 actionable AI suggestions for future submissions
- Saves to `rfps.lessons_learned`

**New files**:
- `src/pages/RfpDetail.tsx`
- `src/hooks/useRfpSections.ts`
- `src/components/rfps/RfpOverviewTab.tsx`
- `src/components/rfps/ResponseBuilderTab.tsx`
- `src/components/rfps/SectionPreviewCard.tsx`
- `src/components/rfps/RegenerateModal.tsx`
- `src/components/rfps/ProjectSelector.tsx`
- `src/components/rfps/DebriefTab.tsx`
- `src/components/rfps/GeneratedFilesTab.tsx`
- `supabase/functions/generate-rfp-response/index.ts`
- `supabase/functions/analyze-rfp-outcome/index.ts`

---

### Phase 4: Export + Polish
**Goal**: Word document export, verification emails, and final polish.

**Word Export**:
- Since `docx` library is Node.js-only and edge functions run Deno, export will be handled by generating a formatted HTML document that can be downloaded, or by using a Deno-compatible approach
- Alternative: Generate a well-formatted PDF using `@react-pdf/renderer` (already installed) with cover page, section headers, rate tables, and flowing narrative text
- Store generated files in backend storage (`rfp-responses` bucket)
- Version history of exports

**Contact Verification**:
- "Send Verification Email" button on notable projects
- Uses existing Gmail integration (`gmail-send` edge function) to send templated verification emails
- Updates `reference_last_verified` timestamp
- Visual indicators: green check (verified < 90 days), warning (> 90 days or never)

**Navigation Integration**:
- Add "RFPs" item to sidebar navigation under main nav
- Add `rfps` to permission resources
- Route guards for `/rfps`, `/rfps/library`, `/rfps/:id`

---

## Technical Details

### Database Schema Summary

```text
dob_applications (ALTER - add columns)
+-- notable boolean DEFAULT false
+-- rfp_tags text[]
+-- reference_contact_name text
+-- reference_contact_title text
+-- reference_contact_email text
+-- reference_contact_phone text
+-- reference_notes text
+-- reference_last_verified timestamptz

rfp_content (NEW)
+-- id uuid PK
+-- company_id uuid FK -> companies
+-- content_type text (firm_history, staff_bio, pricing, narrative_template, certification, company_info)
+-- title text
+-- content jsonb
+-- tags text[]
+-- file_url text
+-- timestamps

rfps (NEW)
+-- id uuid PK
+-- company_id uuid FK -> companies
+-- title, agency, rfp_number, due_date
+-- status text (prospect, drafting, submitted, won, lost)
+-- uploaded_pdf_url, requirements jsonb
+-- mwbe_goal_min/max numeric
+-- response_draft_url, submitted_at, outcome, contract_value
+-- debrief_notes, lessons_learned jsonb
+-- created_by uuid FK -> profiles
+-- timestamps

rfp_sections (NEW)
+-- id uuid PK
+-- rfp_id uuid FK -> rfps (CASCADE)
+-- section_type, content jsonb
+-- ai_generated, reviewed boolean
+-- display_order integer
+-- timestamps
```

### AI Integration
- All AI calls use Lovable AI gateway (`google/gemini-3-flash-preview`)
- PDF parsing uses tool calling for structured extraction
- Narrative generation uses streaming for progress feedback
- Edge functions handle 429/402 errors gracefully

### RLS Policies
All new tables use company-scoped RLS:
- SELECT/INSERT/UPDATE/DELETE restricted to users whose `get_user_company_id()` matches `company_id`
- `rfp_sections` inherits access through `rfp_id` join to `rfps.company_id`

### Recommended Build Order
1. Phase 1 first (database + library) -- foundation everything depends on
2. Phase 2 next (kanban + upload) -- the entry point for the feature
3. Phase 3 (detail + AI generation) -- the core value
4. Phase 4 (export + polish) -- finishing touches
