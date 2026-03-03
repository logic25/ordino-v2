

# Billing Page Improvements: Tooltips, Paid Tab Filters, Deposit Workflow, Schedule Auto-Send

## Issues Identified

### 1. Risk Badge Missing Tooltip
The `RiskBadge` component in `CollectionsView.tsx` (line 88-102) renders a plain `Badge` without any `Tooltip` wrapper. Hovering "Risk 88" shows nothing. Same issue with `PromiseBadge`, the "X days" badge, and other badges in the collections cards.

### 2. Paid Tab Has No Filters or Monthly Totals
The Paid tab renders the same `InvoiceTable` component as Draft/Sent tabs -- no date filtering, no monthly grouping, no running total. For accounting purposes, users need to see "how much was paid this month" at a glance.

### 3. Deposit "New Deposit" Button Workflow
The "New Deposit" button in `RetainersView.tsx` currently opens a dialog that only asks for Client + Amount + Notes. It does NOT link to a project, does not create an invoice record, and does not produce a receipt. This is disconnected from the proposal-based deposit flow built via the `process-deposit-payment` edge function. It should also create an invoice and retainer transaction.

### 4. Billing Schedules Auto-Send
The `process-billing-schedules` edge function creates a `billing_request` (and optionally an invoice if `auto_approve` is on), but it does NOT auto-send the invoice to the client. The invoice lands in "Ready to Send" status -- it still requires manual sending. There's no payment method/link attached either. The schedule dialog also doesn't capture a payment method preference.

---

## Plan

### Task 1: Add Tooltips to All Collection Badges

**Files**: `src/components/invoices/CollectionsView.tsx`

- Wrap `RiskBadge` output in `Tooltip` -- show "Payment risk score: {score}/100. {explanation}" where explanation varies by range (80+ = High risk, 60-79 = Elevated, 40-59 = Moderate, below 40 = Low)
- Wrap `PromiseBadge` in `Tooltip` -- show promise details (date, status)
- Wrap the "{X} days" `Badge` in `Tooltip` -- show "Overdue by {X} days since {due_date}"
- Import `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` from UI components

### Task 2: Paid Tab -- Add Date Filters and Monthly Summary

**Files**: `src/pages/Invoices.tsx`, new component `src/components/invoices/PaidView.tsx`

Create a dedicated `PaidView` component (similar pattern to `BillingSentTable`) that includes:
- Date range picker (default: current month)
- Search filter
- Summary cards: "This Month" total paid, "This Week" total paid, count
- Monthly total displayed prominently
- Payment method breakdown (card/check/ACH)
- The existing grouped `InvoiceTable` below the summary, filtered to `status = "paid"`

Wire it up in `Invoices.tsx` so that `activeFilter === "paid"` renders `<PaidView />` instead of the generic `InvoiceTable`.

### Task 3: Fix "New Deposit" Button to Create Full Records

**Files**: `src/components/invoices/RetainersView.tsx`

Update the "New Deposit" create dialog to:
- Add a Project selector (required) -- so the deposit is linked to a project
- Add a Payment Method selector (card/check/ACH/wire)
- On submit: call the existing `process-deposit-payment` edge function (or create a similar admin version that uses the authenticated user's context) to create:
  - `client_retainers` record
  - `retainer_transactions` entry (type: deposit)
  - A "paid" invoice with line item "Deposit - {Project Name}"
- Show success with the invoice number created

Since the existing `process-deposit-payment` function is designed for unauthenticated proposal flows, create a small wrapper or modify `useCreateRetainer` to also insert the invoice and transaction in a single flow.

### Task 4: Add Auto-Send Option to Billing Schedules

**Files**: `src/components/invoices/BillingScheduleDialog.tsx`, `supabase/functions/process-billing-schedules/index.ts`

- Add a "Payment method" field to the schedule dialog (optional: card/check/ACH)
- Add an "Auto-send invoice" toggle (separate from auto-approve)
- Database migration: add `auto_send boolean default false` and `payment_method text` columns to `billing_schedules`
- Update the edge function: when `auto_send` is true and an invoice is created, set `sent_at = now()` and status to `"sent"` instead of `"ready_to_send"`
- Note: Actual email delivery would require calling `gmail-send` -- for now, mark it as sent and log an activity entry. Add a tooltip explaining "Auto-send marks the invoice as sent; email delivery requires Gmail integration"

---

## Technical Details

### Database Migration
```sql
ALTER TABLE public.billing_schedules 
  ADD COLUMN auto_send boolean DEFAULT false,
  ADD COLUMN payment_method text;
```

### Files Summary

| Action | File |
|--------|------|
| Modify | `src/components/invoices/CollectionsView.tsx` -- add tooltips to Risk, Promise, days badges |
| Create | `src/components/invoices/PaidView.tsx` -- dedicated paid tab with filters and monthly totals |
| Modify | `src/pages/Invoices.tsx` -- render PaidView for paid tab |
| Modify | `src/components/invoices/RetainersView.tsx` -- enhance New Deposit dialog with project, payment method, invoice creation |
| Modify | `src/components/invoices/BillingScheduleDialog.tsx` -- add auto-send toggle and payment method |
| Modify | `src/components/invoices/BillingSchedulesView.tsx` -- show new columns |
| Modify | `supabase/functions/process-billing-schedules/index.ts` -- handle auto-send |
| Migration | Add `auto_send` and `payment_method` to `billing_schedules` |

### Sequence
1. Add tooltips to collection badges (quick)
2. Create PaidView component and wire it up
3. Enhance New Deposit dialog
4. Add auto-send to billing schedules (migration + edge function + UI)

