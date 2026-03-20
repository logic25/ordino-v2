

## Plan: PIS Owner Supersedes PLUTO Owner

### Problem
When a property is created, PLUTO fills `properties.owner_name` with the legal/tax lot owner (often an LLC). When the client later submits a PIS with the actual owner they work with, the trigger only overwrites if the property owner is null/empty/"UNAVAILABLE OWNER" — so the stale PLUTO LLC name persists.

### Changes

**1. Database migration — Update `sync_pis_to_project` trigger**
- Change the property owner sync to **always** overwrite `properties.owner_name` when PIS provides an owner, not just when it's null/empty/UNAVAILABLE
- Also handle the combined company + person name format ("Company — Person") per the earlier decision
- Read both `applicant_and_owner_owner_company` AND `applicant_and_owner_owner_name` from responses, combine them

Current condition:
```sql
WHERE owner_name IS NULL OR owner_name = '' OR owner_name = 'UNAVAILABLE OWNER'
```
New condition: remove the WHERE filter — always update when PIS has owner data.

**2. `src/hooks/useProjectDetail.ts` — Fix `pisOwnerName` extraction**
- Read both `applicant_and_owner_owner_company` and `applicant_and_owner_owner_name` from PIS responses
- Combine as "Company — Person" when both exist, or whichever is available
- This fixes the header still showing "UNAVAILABLE OWNER"

**3. `src/pages/ProjectDetail.tsx` — Update display priority**
- Ensure the fallback chain is: PIS owner → client record → property record (filtered)
- The PIS-sourced name always wins when available

### What this means
- PLUTO data is still fetched and stored — useful for BBL verification and reference
- But once the client submits a PIS, their owner info takes priority everywhere
- No data is lost — PLUTO owner could be shown separately as "Legal owner on record" if needed later

