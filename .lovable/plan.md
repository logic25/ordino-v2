
## Fix plan: wrong and duplicate contacts on converted projects

### What’s actually happening
This is not just the old “CC contacts were migrated” bug.

I checked the current data for the affected project:
- the proposal only has 2 proposal contacts: Marrina (`applicant`) and Jun (`bill_to`)
- the project only has 2 linked `project_contacts`
- but one of those links points to the existing CRM contact **Mike Diller**, because the conversion logic matches contacts by **email first**, and Mike already has the same email as Marrina
- the Contacts tab then also appends raw `proposal_contacts` on top of linked/client contacts, so **Jun shows twice**:
  - once from `client_contacts`
  - once again from `proposal_contacts`

So there are really **2 bugs**:

1. **Wrong CRM match during proposal → project conversion**
   - File: `src/hooks/useProposals.ts`
   - Current logic:
     - for each proposal contact, try to find an existing `client_contact` by email
     - if email matches, reuse that record
   - Problem:
     - shared/family/company emails can belong to the wrong person
     - in this case Marrina reused Mike’s CRM record because they share `chrisphenry2003@yahoo.com`

2. **Contacts tab merges sources incorrectly**
   - File: `src/hooks/useProjectDetail.ts`
   - Current logic merges:
     - client’s `client_contacts`
     - linked `project_contacts`
     - raw `proposal_contacts`
   - Problem:
     - raw proposal contacts are shown even after the project already has linked CRM contacts
     - dedupe keys differ (`id` vs email/name), so the same person can appear twice under different source rows

## Implementation changes

### 1. Make contact matching safer in proposal conversion
Update `src/hooks/useProposals.ts` so proposal-to-project migration does **not** match by email alone.

Planned matching order:
1. if `client_id` + exact name match exists under that client, use it
2. else if exact name match exists within company, use it
3. else if email match exists **and** the matched contact name is also the same/similar, use it
4. otherwise create a new `client_contact`

This prevents “same email, different person” collisions like Marrina → Mike.

### 2. Stop showing raw proposal contacts once the project has linked contacts
Update `src/hooks/useProjectDetail.ts`:
- prefer actual project-linked contacts + client contacts
- only fall back to raw `proposal_contacts` if there are **no linked project contacts yet**
- normalize dedupe to one stable person key, ideally based on:
  - linked CRM contact id when available
  - otherwise normalized `name + email`

This removes the duplicate Jun row.

### 3. Tighten dedupe across all sources
Still in `useProjectDetail.ts`:
- use a consistent dedupe helper instead of mixing `id` keys for one source and `email/name` keys for another
- when a person appears from multiple sources, prefer the richer record in this order:
  1. linked project contact
  2. client contact
  3. proposal fallback

### 4. Preserve intended behavior
Keep the current allowed migration roles:
- `applicant`
- `bill_to`
- `sign`

Continue excluding:
- `cc`
- any other non-project-only roles

So this fix won’t regress the earlier bug fix.

### 5. Add regression tests
Add/update tests around:
- proposal conversion with two contacts sharing the same email as an unrelated existing CRM contact
- project contact list dedupe when the same person exists in both `client_contacts` and `proposal_contacts`
- no migration of `cc` contacts

## Files to update
- `src/hooks/useProposals.ts`
- `src/hooks/useProjectDetail.ts`
- likely a new or expanded test file under `src/test/`

## Expected result after fix
For the reported case:
- Mike Diller will no longer be pulled into the project unless explicitly selected
- Jun Nakamura will appear only once
- the Contacts tab will reflect the project’s true linked contacts instead of mixing in stale proposal rows

## Technical note
The database data confirms the diagnosis:
- proposal `07d3843a-8898-4970-b370-ec2d51f47707` contains only Marrina + Jun
- project `67b0777c-cd7c-440b-9307-add77e621884` links to:
  - `Mike Diller` as `applicant`
  - `Jun Nakamura` as `bill_to`
- Mike was selected only because the migration code matched Marrina’s email to an unrelated existing `client_contacts` row

