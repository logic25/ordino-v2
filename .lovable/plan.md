

# Fix Client Preview Header/Footer and Post-Signing Flow

## Problem 1: Header & Footer Missing on Client Preview

The header and footer code exists in `ClientProposal.tsx` and renders unconditionally. The company data (name, address, phone, email, website) all exist in the database for your company. The most likely cause is a **query timing issue** -- the `company` query depends on `proposal?.company_id` being available, and if the proposal query is slow or the component re-renders before company data loads, the header renders with empty values (no logo, no name, no address = visually blank).

**Fix:**
- Add a loading guard so the document only renders once BOTH `proposal` AND `company` data have loaded (currently only checks for `proposal`)
- Add a fallback company name in the header when `company` is still loading, so the header is never visually empty
- Ensure the footer always shows something (at minimum, the company name) even if settings fields are blank

## Problem 2: Post-Signing -- Dedicated Next Steps Page

Currently after signing, the retainer payment card and PIS card appear as small cards stacked below the full contract document. The user has to scroll past the entire proposal to see them.

**Change:** After the client signs, replace the contract view with a dedicated "Next Steps" page that shows:

1. **Confirmation banner** at the top (proposal accepted, checkmark)
2. **Welcome email status** card
3. **Retainer Payment** section (full-width, prominent) with the existing card/ACH payment flow
4. **Project Information Sheet** link card
5. A "View Signed Proposal" button at the bottom to toggle back to the full contract if they want to review it

This is a view-state toggle within the same component -- when `alreadySigned` is true, the component shows the "Next Steps" view by default, with an option to switch back to viewing the signed contract.

## Technical Steps

### 1. ClientProposal.tsx -- Loading guard
- Add `isCompanyLoading` from the company query
- Show the spinner until BOTH proposal AND company are loaded
- Ensures the header always has data when it renders

### 2. ClientProposal.tsx -- Post-signing view toggle
- Add a `viewMode` state: `"next-steps" | "contract"` (defaults to `"next-steps"` when `alreadySigned`)
- When `viewMode === "next-steps"`: render the confirmation, payment, and PIS sections as a dedicated full-page layout (not below the contract)
- When `viewMode === "contract"`: render the signed contract as it is now
- Add a "View Signed Proposal" button in the next-steps view and a "Back to Next Steps" button in the contract view
- The retainer payment and PIS sections get more visual prominence in this dedicated layout

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/ClientProposal.tsx` | Add company loading guard, implement post-signing view toggle with dedicated Next Steps page |

