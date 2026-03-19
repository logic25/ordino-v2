

## CitiSignal Complimentary Subscription Safeguards — Complete

### What was built:

**1. Database migration** ✅
- Added 6 columns to `signal_subscriptions`: `is_complimentary`, `enrolled_by`, `linked_project_id`, `monthly_rate`, `billing_start_date`, `comp_reason`

**2. useSignalSubscriptions hook updated** ✅
- Types include all new fields + joined `enrolled_by_name`, `linked_project_name`, `linked_project_phase`
- `useEnrollProperty` auto-sets `enrolled_by` to current user's profile ID
- `useSignalSubscription` fetches joined profile name and project info

**3. SignalEnrollDialog enhanced** ✅
- Complimentary toggle (only enabled when property has active projects)
- Linked project selector (required when complimentary)
- Comp reason textarea
- Monthly rate + billing start date inputs (for paid active subs)
- Trial auto-expiry (14 days), comp auto-expiry (1 year)
- Enrolled-by shown read-only on edit

**4. SignalSection updated** ✅
- Shows "Sold by: [Name]"
- Shows "Complimentary — linked to [Project Name]" or "Paid — $X/mo"
- Expiration countdown with color warnings
- Warning badge if linked project closed or no linked project on comp

**5. SignalStatusBadge updated** ✅
- Gift icon shown for complimentary subscriptions

---

## Fix: Wrong & Duplicate Contacts on Converted Projects — Complete

### Bugs fixed:

**1. Contact matching used email-only (caused wrong CRM match)** ✅
- `migrateProposalContactsToProject()` now matches by: exact name first → email+name verification → create new
- Prevents "same email, different person" collisions (e.g. Marrina → Mike Diller)
- Extracted into a shared utility used by both `useSignProposalInternal` and `useMarkProposalApproved`

**2. `useMarkProposalApproved` was missing contact migration entirely** ✅
- Added `migrateProposalContactsToProject()` call to the approval flow

**3. Contacts tab showed duplicates from multiple sources** ✅
- `useProjectContacts` now: if project has linked `project_contacts`, show ONLY those
- Falls back to client contacts + proposal contacts only when no linked contacts exist
- Deduplication uses name+email normalization instead of mixing id-based and string-based keys

### Files changed:
- `src/hooks/useProposals.ts` — extracted `migrateProposalContactsToProject()`, simplified internal sign contact migration
- `src/hooks/useProposalFollowUps.ts` — added contact migration to approval flow
- `src/hooks/useProjectDetail.ts` — rewrote `useProjectContacts` with proper source priority and deduplication
- `src/test/contactMigration.test.ts` — 7 regression tests covering matching, deduplication, and role filtering
