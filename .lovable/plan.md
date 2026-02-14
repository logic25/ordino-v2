

# Collections UX Improvements + ClaimFlow Package + Test Property

## Overview

Four changes: (1) clean up the crowded action icons on collection cards, (2) add CC payment option with fee reminder to the ACH step, (3) add signed proposal/contract to the ClaimFlow legal package and show a statute of limitations reminder, (4) add a test property for 420 Lexington Ave.

---

## 1. Consolidate Collection Card Action Icons

Currently critical-tier cards show 7 icon buttons in a row. Collapse the less-frequent actions into a dropdown.

**Keep as direct icons (always visible):**
- Note (StickyNote)
- Promise (HandCoins)
- Reminder (Mail)

**Move into a "More" dropdown menu (DropdownMenu):**
- Payment Plan
- Demand Letter
- ClaimFlow
- Write Off (critical only)

**File to modify:**
- `src/components/invoices/CollectionsView.tsx` — Replace the inline buttons for Payment Plan, Demand Letter, ClaimFlow, and Write Off with a single `MoreHorizontal` icon that opens a `DropdownMenu` with labeled menu items.

---

## 2. ACH or Credit Card Option with Fee Notice

Add a payment method selector at the top of the ACH Authorization Step so clients can choose ACH (no fee) or Credit Card (with a surcharge reminder).

**What changes:**
- Add a toggle/radio at the top of `ACHAuthorizationStep`: "ACH (No Fee)" vs "Credit Card (3% processing fee applies)"
- If CC is selected, hide the bank info fields and show a note: "Credit card details will be collected when the self-service portal is available. The client acknowledges a 3% processing surcharge."
- Store the selected `payment_method` ("ach" or "credit_card") in the `ach_authorizations` table

**Database change:**
- Add `payment_method` column (text, default "ach") to `ach_authorizations` table

**Files to modify:**
- `src/components/invoices/ACHAuthorizationStep.tsx` — Add payment method selector, conditionally show/hide bank fields, pass method through `onSign` callback
- `src/components/invoices/PaymentPlanDialog.tsx` — Pass new field through to save mutation
- `src/hooks/usePaymentPlans.ts` — Include `payment_method` in ACH save mutation

---

## 3. Enhance ClaimFlow Package with Signed Proposal + Deadline Reminder

The ClaimFlow dialog should:
- Add "Signed proposal / contract" to the legal package contents list
- Show a statute of limitations reminder (6 years for written contracts in NY)
- Display what the "output" looks like — a summary card showing the full package manifest

**What changes in ClaimFlowDialog:**
- Add a `FileSignature` icon row: "Signed proposal / contract (if available)" to the package items list
- Add a `Scale` icon row: "Client contact information & billing details"
- Add an info callout at the bottom: "NY Statute of Limitations: You have up to 6 years from breach date to file a small claims action for written contracts."
- Show a "Package Preview" section with a bordered card that looks like a cover sheet: Company name, Client name, Invoice number, Amount owed, Days overdue, Filing deadline estimate, and a checklist of all included documents

**File to modify:**
- `src/components/invoices/ClaimFlowDialog.tsx` — Expand `packageItems` array, add statute reminder, add preview card section

---

## 4. Add Test Property: 420 Lexington Ave

Navigate to the Properties page and add a new property with address "420 Lexington Avenue, New York, NY 10170" (the Graybar Building in Midtown Manhattan). This is a manual action through the UI — no code change needed, just using the existing Add Property flow.

---

## Technical Details

### Database Migration
```sql
ALTER TABLE ach_authorizations 
  ADD COLUMN payment_method text NOT NULL DEFAULT 'ach';
```

### Files to Create
None

### Files to Modify
1. `src/components/invoices/CollectionsView.tsx` — Refactor InvoiceCard action buttons into 3 direct icons + MoreHorizontal dropdown
2. `src/components/invoices/ACHAuthorizationStep.tsx` — Add ACH/CC toggle with fee notice, conditionally show bank fields
3. `src/components/invoices/PaymentPlanDialog.tsx` — Pass payment_method through
4. `src/hooks/usePaymentPlans.ts` — Save payment_method to ach_authorizations
5. `src/components/invoices/ClaimFlowDialog.tsx` — Add signed proposal to package, statute reminder, preview card

### Sequencing
1. Database migration (add payment_method column)
2. Consolidate collection card icons into dropdown
3. Add CC option to ACH step
4. Enhance ClaimFlow dialog with proposal + deadline
5. Add 420 Lexington property via UI
