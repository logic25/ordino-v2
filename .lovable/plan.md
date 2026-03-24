

## Plan: Simplify Contact Roles + Replace DOB Role Column

### Status: Implemented ✅

### Changes Made

1. **Removed "Signer" role** — `ContactRole` type now: `bill_to | cc | applicant`
2. **Updated role options** — ProposalContactsSection shows Bill To, Applicant, CC
3. **Updated migration logic** — `migrateProposalContactsToProject` migrates only `applicant` and `bill_to`, treats legacy `sign` as `bill_to`
4. **Replaced "DOB Role" column** — ContactsFull.tsx now shows project role (Bill To, Applicant, Building Owner, CC, Contact) instead of `dobRoleLabels[c.dobRole]`
5. **Updated role display** — `useProjectDetail.ts` maps roles correctly without "Signer"
6. **Database migration** — Existing `sign` roles converted to `bill_to` in both `proposal_contacts` and `project_contacts`
7. **PDF signature compat** — Preview modal and client proposal still check for legacy `sign` contacts as fallback

### Deferred
- PIS owner auto-dedup into CRM contacts (synthetic owner row still works as-is)

---

## Plan: Unify Service Conditions into Project Readiness

### Status: Implemented ✅

### Changes Made

1. **Removed from Readiness panel** — "PIS Responses" collapsible, "Add Item" button, "Generate AI Checklist" button all removed
2. **Service conditions → DB** — `ServicesFull.tsx` pre-filing conditions now use `useProjectChecklist` hooks instead of localStorage, writing to `project_checklist_items` with `source_service_id` and `source_catalog_name`
3. **Service badge in Readiness** — Items with `source_catalog_name` show a small badge identifying which service they belong to
4. **Kept**: PIS status bar + Edit PIS button, checklist items display, AI Follow-Up Draft button, Received section
