

# Payment Plan ACH Authorization + ClaimFlow Button

## Overview

Two additions to the collections and payment plan workflow:

1. **ACH Authorization Agreement** -- When creating a payment plan, add a step where the client must sign an ACH authorization form. This uses a canvas-based signature pad (same pattern as the existing proposal signature). The signed agreement is stored and attached to the plan. The actual auto-debit processing (Stripe/QBO) is deferred.

2. **ClaimFlow Button** -- A new escalation action on critical/urgent collection cards (and the invoice detail sheet) branded "ClaimFlow" that packages the invoice for small claims referral. This replaces the previously discussed "Refer to Attorney" concept.

---

## 1. ACH Authorization in Payment Plan

### What the user sees

After configuring installments in the Payment Plan Dialog, a second step appears:

- **ACH Authorization Agreement** text (NACHA-compliant language including: company name, authorization to debit, right to revoke, installment schedule summary)
- **Client name** and **bank info fields** (routing number, account number, account type) -- these are collected but not processed until a payment processor is connected
- **Canvas signature pad** (reusing the same drawing logic from SignatureDialog)
- **"I Agree & Sign" button** that saves the authorization

### Database changes

- New table: `ach_authorizations`
  - `id`, `company_id`, `payment_plan_id`, `invoice_id`, `client_id`
  - `client_name` (text), `bank_name` (text, nullable)
  - `routing_number_last4` (text, nullable -- only store last 4 for security)
  - `account_number_last4` (text, nullable)
  - `account_type` (text: "checking" or "savings")
  - `authorization_text` (text -- the full agreement they signed)
  - `signature_data` (text -- base64 PNG from canvas)
  - `signed_at` (timestamptz)
  - `ip_address` (text, nullable)
  - `status` ("active", "revoked")
  - `created_at`, `updated_at`
  - RLS: scoped to company_id

### Files to create

- `src/components/invoices/ACHAuthorizationStep.tsx` -- The authorization form with agreement text, bank info fields, and signature canvas. Reuses the same canvas drawing pattern from `SignatureDialog.tsx`.

### Files to modify

- `src/components/invoices/PaymentPlanDialog.tsx` -- Add a second step after installment configuration. Step 1 = current installment setup. Step 2 = ACH authorization. The "Create Plan" button moves to step 2 and saves both the plan and the signed authorization.
- `src/hooks/usePaymentPlans.ts` -- Add mutation to save ACH authorization after plan creation.

---

## 2. ClaimFlow Button

### What the user sees

On critical and urgent collection invoice cards, a new button appears with a "ClaimFlow" label and a gavel/scale icon. Clicking it opens a dialog that:

- Shows the invoice summary (client, amount, days overdue)
- Lists what will be included in the legal package (invoice PDFs, follow-up history, demand letters, payment promises)
- Has a "Send to ClaimFlow" button that logs the action and changes invoice status to `legal_hold`
- For now, the action is logged and the invoice is flagged -- future integration with the ClaimFlow app will be added later

### Database changes

- Add `legal_hold` to the invoice status options (via a new status value in the app -- since the DB column is text, no enum migration needed)
- New table: `claimflow_referrals`
  - `id`, `company_id`, `invoice_id`, `client_id`
  - `case_notes` (text, nullable)
  - `status` ("pending", "filed", "resolved", "dismissed")
  - `created_by` (uuid, references profiles)
  - `created_at`, `updated_at`
  - RLS: scoped to company_id

### Files to create

- `src/components/invoices/ClaimFlowDialog.tsx` -- Dialog showing invoice summary, package contents checklist, case notes field, and "Send to ClaimFlow" button.
- `src/hooks/useClaimFlow.ts` -- Hook for creating referrals and querying status.

### Files to modify

- `src/hooks/useInvoices.ts` -- Add `legal_hold` to the `InvoiceStatus` type.
- `src/components/invoices/InvoiceStatusBadge.tsx` -- Add badge style for `legal_hold` (purple/indigo theme).
- `src/components/invoices/CollectionsView.tsx` -- Add ClaimFlow button to critical and urgent tier invoice cards (next to the demand letter button). Import and render `ClaimFlowDialog`.
- `src/components/invoices/InvoiceDetailSheet.tsx` -- Add "ClaimFlow" button in the Collections Actions section for overdue invoices.
- `src/components/invoices/InvoiceFilterTabs.tsx` -- Account for `legal_hold` status in filters if needed.

---

## Technical Details

### ACH Authorization Agreement Text (Template)

The agreement will include standard NACHA-compliant language:
- Company name and authorization scope
- Installment schedule summary (amounts, dates)
- Right to revoke with written notice
- Effective date and client signature

Bank details (routing/account numbers) are collected via masked inputs and only the last 4 digits are stored in the database. Full numbers are not persisted until a payment processor is integrated.

### Sequencing

1. Create `ach_authorizations` and `claimflow_referrals` tables with RLS policies
2. Build `ACHAuthorizationStep` component
3. Add step 2 to `PaymentPlanDialog`
4. Build `ClaimFlowDialog` component and `useClaimFlow` hook
5. Add ClaimFlow button to `CollectionsView` and `InvoiceDetailSheet`
6. Update `InvoiceStatusBadge` with `legal_hold` style
