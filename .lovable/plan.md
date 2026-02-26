

# Change Order: Auto-Send, Deposit, and Terms Reference

## Changes

### 1. Database Migration
Add columns to `change_orders`:
- `deposit_percentage` (numeric, default 0) -- percentage of CO total required as deposit
- `deposit_paid_at` (timestamptz, nullable) -- when client paid

### 2. Change Order Dialog -- Add Deposit Field
**File:** `src/components/projects/ChangeOrderDialog.tsx`

Add a "Deposit Required (%)" number input below the "Requested By" selector. Show a calculated preview (e.g., "Deposit: $1,250 of $2,500"). Wire it into `handleSubmit` so `deposit_percentage` is saved.

### 3. Update Hook
**File:** `src/hooks/useChangeOrders.ts`

Add `deposit_percentage` to the `ChangeOrder` interface and `ChangeOrderFormInput`. Include it in insert/update calls.

### 4. Client Signing Page -- Auto-Send Copy
**File:** `src/pages/ClientChangeOrder.tsx`

Remove the "Want a copy?" prompt. After the sign mutation succeeds, automatically invoke `gmail-send` to email the signed CO summary to `co.sent_to_email`. Show a small status indicator: "Sending signed copy..." then "Signed copy sent to [email]" (matching the proposal's welcome email pattern).

### 5. Client Signing Page -- Terms Reference
**File:** `src/pages/ClientChangeOrder.tsx`

Add a clause above the signature area stating:
> "By signing this Change Order, you acknowledge that all terms and conditions of the original proposal/contract remain in full effect. This Change Order modifies only the scope and fees described above."

This mirrors the legal framing used on the proposal page's Terms section.

### 6. Client Signing Page -- Deposit Payment
**File:** `src/pages/ClientChangeOrder.tsx`

After signing, if `deposit_percentage > 0`, show a "Pay Deposit" card (matching the proposal's payment UI):
- Calculate deposit amount from `co.amount * (deposit_percentage / 100)`
- Card/ACH mock payment forms (same pattern as `ClientProposal.tsx`)
- On "payment success," update `deposit_paid_at` on the CO record
- Show receipt summary

### 7. Detail Sheet and PDF
**Files:** `src/components/projects/ChangeOrderDetailSheet.tsx`, `src/components/projects/ChangeOrderPDF.tsx`

- Show deposit percentage and calculated amount in the detail view
- Add "Deposit Due Upon Signing" line to the PDF when `deposit_percentage > 0`
- Show deposit payment status if paid

## Technical Sequence
1. Run database migration (add columns)
2. Update `useChangeOrders.ts` with new fields
3. Add deposit input to `ChangeOrderDialog.tsx`
4. Rewrite post-sign flow in `ClientChangeOrder.tsx` (auto-send + terms clause + deposit payment)
5. Update detail sheet and PDF

