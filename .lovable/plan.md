

# Fix Badge Mismatch, Wire Deposit Payments, Create Deposit Receipt PDF

## Overview

Three connected issues to resolve:
1. "To Invoice" tab shows "4" but the tab is empty -- caused by a query key collision
2. Client deposit payments on the proposal page are mock (just a `setTimeout`) -- no records created
3. Need a Deposit Receipt PDF that auto-generates when a client pays

---

## 1. Fix "To Invoice" Badge Showing Wrong Number

**Root cause**: Both `useUnreadIndicators` and `usePendingBillingCount` use the same React Query key `billing-pending-count`, but query different tables:
- `useUnreadIndicators` counts **invoices** with status `ready_to_send` (returns 4)
- `usePendingBillingCount` counts **billing_requests** with status `pending` (returns 0)

Whichever resolves first gets cached and shared with the other hook.

**Fix**: Rename the query key in `useUnreadIndicators.ts` from `billing-pending-count` to `billing-sidebar-badge` so each hook maintains its own cache.

| File | Change |
|------|--------|
| `src/hooks/useUnreadIndicators.ts` | Rename query key to `billing-sidebar-badge` |

---

## 2. Wire Up Real Deposit Payments

Currently, the payment buttons on `ClientProposal.tsx` call `setTimeout(() => setPaymentStep("success"), 2500)` -- pure mock. No database records are created.

### New Edge Function: `process-deposit-payment`

Since the proposal page is public (no auth), we need an edge function with service-role access to create records.

**Accepts**:
```json
{
  "proposal_token": "abc123...",
  "payment_method": "card",
  "amount": 4250
}
```

**Performs** (server-side with service role):
1. Validate the proposal exists, is `executed`, and has a `converted_project_id`
2. Look up the client from the proposal
3. Create a `client_retainers` record (deposit) with `original_amount` and `current_balance` = amount
4. Create a `retainer_transactions` record (type: `deposit`)
5. Create a `paid` invoice with a single line item "Deposit -- Proposal #XXXXXX" and `payment_method` set
6. Set `deposit_paid_at` on the proposal
7. Return receipt data (invoice number, date, amount)

**Config**: Add `verify_jwt = false` in `supabase/config.toml` for this function.

### Update ClientProposal.tsx

- Replace all three `setTimeout` calls with `supabase.functions.invoke("process-deposit-payment", { body: {...} })`
- On success, show the receipt with real invoice number from the response
- Rename remaining "retainer" labels to "deposit" ("Pay Retainer Deposit" becomes "Pay Deposit", "Your retainer of..." becomes "Your deposit of...")

| File | Change |
|------|--------|
| `supabase/functions/process-deposit-payment/index.ts` | New edge function |
| `supabase/config.toml` | Add `verify_jwt = false` for the function |
| `src/pages/ClientProposal.tsx` | Replace mock payment with real edge function call; rename retainer labels |

---

## 3. Deposit Receipt PDF

Create a `DepositReceiptPDF` component using `@react-pdf/renderer` (already installed). This receipt is what the client sees after paying and what gets emailed as confirmation.

**Layout** (single page, A4):

```text
+--------------------------------------------------+
|  [Company Name]                   DEPOSIT RECEIPT |
|  Address / Phone / Email             Receipt #DR-X|
|                                      Date: Mar 3  |
|--------------------------------------------------|
|  RECEIVED FROM                    PROJECT         |
|  Client Name                      #2026-0001      |
|  Client Email                     Project Name    |
|--------------------------------------------------|
|  Description                             Amount   |
|  ------------------------------------------------|
|  Deposit - Proposal #030326-1           $4,250.00 |
|--------------------------------------------------|
|                            Total Paid  $4,250.00  |
|--------------------------------------------------|
|  Payment Method: Credit Card                      |
|  Reference: Proposal #030326-1                    |
|--------------------------------------------------|
|  This deposit will be applied as a credit toward  |
|  future invoices for the above project.           |
|--------------------------------------------------|
|        Thank you for your business!               |
+--------------------------------------------------+
```

This component will be rendered in two places:
- **ClientProposal.tsx**: A "Download Receipt" button appears after payment success, using `BlobProvider` to generate the PDF client-side
- **InvoicePDFPreview**: The existing preview dialog can render deposit receipts when the invoice is a deposit type

| File | Change |
|------|--------|
| `src/components/invoices/DepositReceiptPDF.tsx` | New PDF component |
| `src/pages/ClientProposal.tsx` | Add "Download Receipt" button after payment success |

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/hooks/useUnreadIndicators.ts` -- fix query key |
| Create | `supabase/functions/process-deposit-payment/index.ts` -- process real payments |
| Modify | `supabase/config.toml` -- add verify_jwt config |
| Create | `src/components/invoices/DepositReceiptPDF.tsx` -- receipt PDF |
| Modify | `src/pages/ClientProposal.tsx` -- wire real payments, add receipt download, rename labels |

## Sequence

1. Fix badge (1 line change)
2. Create edge function for deposit processing
3. Create DepositReceiptPDF component
4. Update ClientProposal.tsx to use both

