

# PM Continuity Engine -- Final Build Plan

## Summary

This plan eliminates PM handoff gaps by making every project self-documenting. When a PM is out, anyone stepping in sees exactly what's done, what's outstanding, who it's waiting on, and how long it's been waiting.

## Known Gaps (NOT in this plan, noted for future)

- Change orders / adding services mid-project
- Per-service billing party changes (e.g., Samsung project billed partly to KSC, partly to Cheil)
- DOB filing fee pass-through tracking on invoices
- Subcontractor/vendor management (hiring architects for plans, tracking their deliverables and invoices)
- AI-drafted automated follow-up emails for overdue checklist items

---

## What Gets Built (4 Things)

### 1. Persistent, Service-Driven Readiness Checklist

Replace the hard-coded, in-memory checklist on Project Detail with a database-backed one that auto-populates from service templates.

- Each service in the Service Catalog gets an optional "default requirements" list
- When a project has those services, requirements auto-populate into the checklist
- Items persist with status, "from whom," and days-waiting tracking
- Duplicate services (e.g., 3x ALT-2 filings) deduplicate their template items -- one set of shared requirements, not 3x copies

### 2. PIS Clone for Repeat Addresses + New Fields

- When sending a PIS for a project at an address with prior projects, offer to pre-fill from the previous PIS
- Add Filing Type field (Plan Exam / Pro-Cert / TBD) to PIS Applicant section
- Add Client Reference Number field (e.g., NY Tent #611490) to PIS
- Both sync back to project record

### 3. Editable Instruction Templates

User-managed templates in Settings for common instructions sent to owners and architects. Three defaults seeded:

- DOB Registration -- owner creates a DOB NOW account
- DOB E-Sign (Standard) -- owner signs and pays on one application
- DOB E-Sign (Supersede) -- owner signs multiple supersede applications

Templates support variables like job numbers that auto-fill when used from a project.

### 4. Fix "Mark Approved" to Also Create the Project

Currently marking a proposal as approved (physical copy, MSA, email confirmation) only changes status -- it does NOT create the project. The fix: Mark Approved also runs project creation (creates project, copies services, links contacts). One step instead of two.

---

## Technical Details

### Database Migration

**New table: `project_checklist_items`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | RLS scope |
| project_id | uuid FK | to projects |
| label | text | e.g., "Sealed plans from architect" |
| category | text | missing_document, missing_info, pending_signature, pending_response |
| from_whom | text | e.g., "Architect", "Owner" |
| source_service_id | uuid nullable | FK to services |
| source_catalog_name | text nullable | for dedup matching |
| status | text DEFAULT 'open' | open, done, dismissed |
| requested_date | timestamptz | |
| completed_at | timestamptz | |
| sort_order | integer DEFAULT 0 | |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

RLS: SELECT, INSERT, UPDATE, DELETE scoped to company_id via profiles.

**New columns on `projects`:**
- `filing_type` text
- `client_reference_number` text

**Update `sync_pis_to_project()` trigger** to map new PIS response fields to these columns.

**Company settings JSONB additions (no migration needed):**
- `ServiceCatalogItem.default_requirements`: array of `{ label, category, from_whom_role }`
- `instruction_templates`: array of `{ id, name, description, body, variables }`

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useProjectChecklist.ts` | CRUD for `project_checklist_items`, auto-populate from service templates with dedup |
| `src/components/projects/QuickReferenceBar.tsx` | Post-filing header: job numbers with copy, filing type, "Send E-Sign Instructions" button |
| `src/components/projects/ESignInstructionDialog.tsx` | Pre-filled email composer using instruction templates with variable substitution |
| `src/components/settings/InstructionTemplateSettings.tsx` | Settings UI for managing instruction templates |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/ProjectDetail.tsx` | Replace hard-coded checklist with database-backed items; add QuickReferenceBar when DOB applications exist |
| `src/components/projects/EditPISDialog.tsx` | Clone-from-previous logic (query prior PIS by property_id); add filing_type and client_reference_number fields |
| `src/hooks/useRfi.ts` | Add filing_type to applicant section; add client_reference_number to PIS template |
| `src/pages/RfiForm.tsx` | Render new PIS fields |
| `src/hooks/useProposalFollowUps.ts` | Update Mark Approved to also create the project (create project, copy services, link contacts) |
| `src/components/proposals/ProposalTable.tsx` | Keep "Convert to Project" as fallback for legacy proposals |
| `src/components/settings/ServiceCatalogSettings.tsx` | Add default requirements editor per service |
| `src/hooks/useCompanySettings.ts` | Update types for templates and service requirements |
| `src/pages/Settings.tsx` | Add Instruction Templates settings card |

### Checklist Deduplication Logic

When a project has 3x "ALT-2 Filing" services, the auto-populate generates ONE set of template items (not 3 copies), matched by catalog name. Per-service details (floor, description, cost) remain visible in the Services tab.

### Build Order

1. Database migration (checklist table + project columns + trigger update)
2. `useProjectChecklist.ts` hook (CRUD + auto-populate with dedup)
3. Refactor ProjectDetail.tsx checklist to use persisted items
4. Service catalog default requirements editor
5. PIS additions (filing_type, client_reference_number)
6. PIS clone logic for repeat addresses
7. Fix Mark Approved to also create project
8. Instruction templates settings UI with 3 default seeds
9. QuickReferenceBar + ESignInstructionDialog (post-filing)

