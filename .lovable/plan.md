

# Assessment: Research Workspace vs. Prompts 2–4

## What Already Exists

The **ResearchWorkspace** component (`src/components/projects/ResearchWorkspace.tsx`, 602 lines) already implements a significant portion of what Prompts 2–4 describe:

### Already built (with mock data):
- **Objection viewer** with list panel, status badges (open/in_progress/resolved), code section references
- **Status workflow**: open → in_progress → resolved, with auto-advance to next open item
- **Beacon research panel** — query input, structured response cards with code text, confidence scores, past project references, related DOB bulletins
- **PM notes editor** with bold/italic/list toolbar
- **"Clean Up" AI feature** to refine notes into formal strategies
- **"Save to Docs"** and **"Send as Email"** (pre-fills compose dialog to architect)
- **Collapsible left/right panel** layout

### What's missing (all currently mock/hardcoded):
1. **PDF upload + parsing** — "Import Sheet" button loads `MOCK_OBJECTIONS` array. No actual PDF upload or AI extraction.
2. **Real Beacon integration** — `handleBeaconSend` uses `setTimeout` + `MOCK_BEACON_RESPONSES` instead of calling `askBeacon()`.
3. **Database persistence** — All state is local `useState`. No `objection_items` table, no saving to DB.
4. **Draft Response per item** — The notes/clean-up flow exists but isn't wired to save `response_draft` or `architect_instructions` per objection item.
5. **Project context in Beacon** (Prompt 2) — Not passed to any API call.

## Revised Plan

Instead of building new components from scratch, we should **upgrade the existing ResearchWorkspace** to use real data. This is much less work than originally scoped.

### What to build:

**1. Database migration** — `objection_items` table (as planned in Prompt 3), plus `objection_letters` reference to `universal_documents`.

**2. Edge function: `parse-objection`** — Accepts PDF, extracts text, uses Lovable AI (Gemini 2.5 Pro) to parse individual objection items into structured JSON, saves to `objection_items` table.

**3. Hook: `useObjectionItems`** — CRUD hook for `objection_items` by project_id. Fetch, update status, save response_draft/architect_instructions/resolution_notes.

**4. Upgrade ResearchWorkspace** — Replace mock data with real data:
   - "Import Sheet" → opens file picker, uploads PDF, calls `parse-objection`, loads results from DB
   - `handleBeaconSend` → calls real `askBeacon()` with project context (address, filing type, BBL, scope)
   - Status changes → persist to DB via `useObjectionItems`
   - PM notes / Clean Up → save as `response_draft` and `architect_instructions` on the objection item
   - "Save to Docs" → actually saves to `universal_documents`

**5. Project context in `askBeacon()`** (Prompt 2) — Add optional `project_context` to the API call. Pass it from ResearchWorkspace and from BeaconChatWidget when on a project page.

### What we skip:
- No new UI components needed — ResearchWorkspace already has the layout, cards, status workflow, and email integration.
- No separate "Upload Objection Dialog" — the existing "Import Sheet" button becomes the upload trigger.

### File changes:
| File | Change |
|------|--------|
| New migration | `objection_items` table |
| `supabase/functions/parse-objection/index.ts` | New edge function |
| `src/hooks/useObjectionItems.ts` | New CRUD hook |
| `src/services/beaconApi.ts` | Add `project_context` param to `askBeacon()` |
| `src/components/projects/ResearchWorkspace.tsx` | Replace mocks with real DB + Beacon calls |
| `src/components/beacon/BeaconChatWidget.tsx` | Accept + display `projectContext` prop |
| `src/components/layout/AppLayout.tsx` | Pass project context to BeaconChatWidget on project routes |

This consolidates Prompts 2, 3, and 4 into a single upgrade of existing infrastructure. Estimated: ~60% less new code than originally planned.

