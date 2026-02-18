
# Fix Proposal Contact Search Flow

## Problem
The contact card has two issues:
1. The company search field ("Search company...") does not reliably show a dropdown when typing -- the contact search query may fail or return no results, and company matches require an exact client list match.
2. The contact name field (row 2) is a plain text input unless a company is already selected. There's no dropdown to pick from existing contacts without first choosing a company.

The desired flow is: **Company first, then Contact** -- which is already the intended design but the dropdown isn't appearing reliably.

## Root Causes
- The `CompanyCombobox` dropdown only opens when `search.length > 0 || clients.length > 0`, but the `clients` array passed in may be empty or the search text doesn't match any company names.
- The contact query in the combobox searches `client_contacts` by `name` and `email` but not by `company_name`, so typing a company name won't surface contacts either.
- When no company is selected (`client_id` is null), the contact name row renders as a plain `Input` with no dropdown at all.

## Plan

### 1. Fix CompanyCombobox dropdown visibility
- Show the dropdown immediately on focus even with empty search (show all companies up to a limit)
- Add `company_name` to the contact search `.or()` filter so typing a company name surfaces its contacts too
- Ensure the dropdown appears reliably by removing the `search.length > 0` gate (just require `open` state)

### 2. Make Contact Picker always a dropdown
- Even when no company is selected, the contact name field should be a searchable dropdown that queries all `client_contacts` matching the typed text
- When a contact is picked from this global search, auto-fill the company field from the contact's `client_id` / `company_name`
- This gives users two entry points: start from company OR start from contact name -- either way the full record gets populated

### 3. Improve search relevance
- Prioritize company name matches in the dropdown ordering (companies section first, then individual contacts)
- Show company name alongside each contact result for disambiguation

---

## Technical Details

### File: `src/components/proposals/ProposalContactsSection.tsx`

**CompanyCombobox changes:**
- Remove `search.length > 0` condition from dropdown visibility -- show on focus always
- Update the Supabase query on line ~100 to include `company_name` in the `.or()` filter: `name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`
- Show all companies (up to 8) when search is empty on focus

**SortableContactCard changes (around line 430-460):**
- Replace the plain `Input` fallback (when no `client_id`) with a `ContactPicker`-like component that searches all contacts globally
- When a contact is selected from this global search, set `client_id`, `company_name`, `name`, `email`, and `phone` on the card simultaneously

**ContactPicker changes (line 207+):**
- Make it work without a `clientId` prop -- when `clientId` is empty, search all contacts globally instead of filtering by client
- Always show the chevron dropdown indicator
