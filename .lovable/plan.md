

## Plan: Simplify Contact Roles + Replace DOB Role Column + PIS Owner Dedup

### Context

**Current proposal contact roles:**
- `bill_to` → "Bill To" (who gets invoiced)
- `sign` → "Signer" (confusing — used to track people like Matt Miller who bring work)
- `applicant` → "Applicant" (DOB applicant of record)
- `cc` → not shown in UI options but exists in type

**The "Referred By" fields already exist** on the Details & Terms step — both company and person. So a "Referrer" role would be redundant. The real intent of "Signer" was to track client contacts who bring work but aren't bill-to or applicant — that's exactly what "Referred By" already handles.

**Decision:** Remove "Signer" role entirely. Keep **Bill To**, **Applicant**, and **CC**. Referral tracking stays in the existing Referred By fields.

### Changes

#### 1. Remove "Signer" role from proposals

**`src/hooks/useProposalContacts.ts`**
- Change `ContactRole` type from `"bill_to" | "sign" | "cc" | "applicant"` to `"bill_to" | "cc" | "applicant"`

**`src/components/proposals/ProposalContactsSection.tsx`**
- Remove `{ value: "sign", label: "Signer" }` from `ROLE_OPTIONS`
- Keep: Bill To, Applicant, CC

#### 2. Update proposal PDF to handle missing signer

**`src/components/proposals/ProposalPreviewModal.tsx`** and **`src/pages/ClientProposal.tsx`**
- Remove logic that looks for `role === "sign"` contacts
- The signature area should use `bill_to` contact as the client signer (the person being billed is the one who signs)

#### 3. Update conversion migration to drop "sign"

**`src/hooks/useProposals.ts`**
- Change `migrateRoles` from `["applicant", "bill_to", "sign"]` to `["applicant", "bill_to"]`
- Add backward compat: if existing data has `role = "sign"`, treat as `"bill_to"` during migration

#### 4. Replace "DOB Role" with "Role" in project contacts table

**`src/components/projects/tabs/ContactsFull.tsx`**
- Rename column "DOB Role" → "Role"
- Display the project role (`c.role`: "Bill To", "Applicant", "Building Owner", "CC", "Contact") instead of `dobRoleLabels[c.dobRole]`

#### 5. Auto-create deduplicated CRM contact from PIS owner data

**`src/hooks/useProjectDetail.ts`**
- When PIS owner data exists and no matching project contact is found:
  1. Search `client_contacts` by name (case-insensitive) within the company — same dedup logic already used in proposal conversion
  2. If found, link to project via `project_contacts`
  3. If not found, create new `client_contact` record, then link
  4. Set role to `"owner"` on `project_contacts`
- Remove the current synthetic `owner-${projectId}` row injection — replace with real persisted contacts

#### 6. Database migration

```sql
-- Convert existing "sign" roles to "bill_to" in both tables
UPDATE proposal_contacts SET role = 'bill_to' WHERE role = 'sign';
UPDATE project_contacts SET role = 'bill_to' WHERE role = 'sign';
```

### Technical Details

```text
Proposal Roles (before → after):
  bill_to    → Bill To       (kept)
  sign       → removed (migrated to bill_to)
  applicant  → Applicant     (kept)
  cc         → CC            (kept, now shown in UI)

Project Contacts Table:
  Before: Name | DOB Role (Owner/Other) | Company | ...
  After:  Name | Role (Bill To/Applicant/Owner/CC) | Company | ...

PIS Owner Dedup Flow:
  PIS submitted → parse owner name/company
  → search client_contacts by name (ilike) within company
  → if match: link existing contact to project as "owner"
  → if no match: create new client_contact → link to project
```

### Files Modified
- `src/hooks/useProposalContacts.ts` — remove "sign" from type
- `src/components/proposals/ProposalContactsSection.tsx` — remove Signer from role options
- `src/components/proposals/ProposalPreviewModal.tsx` — use bill_to for signature
- `src/pages/ClientProposal.tsx` — use bill_to for signature
- `src/hooks/useProposals.ts` — update migration logic
- `src/hooks/useProjectDetail.ts` — replace synthetic owner with real CRM contact, update role labels
- `src/components/projects/tabs/ContactsFull.tsx` — rename DOB Role → Role, show project role
- Database migration for existing data

