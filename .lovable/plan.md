# Billing fixes round 2 — Deposits, Overdue, Needs Review, Deposit Invoices, Changelog

## 1. Deposits tab — fix "No profile" crash
`src/hooks/useRetainers.ts` and `src/components/invoices/RetainersView.tsx` query `profiles` with `.single()` and no `auth.uid()` filter — RLS returns 0 or many rows, so `.single()` throws "No profile" (this is the toast in the screenshot). Fix every occurrence:

```ts
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("profiles").select("company_id, id")
  .eq("id", user!.id).maybeSingle();
```

After this, **New Deposit** works for any Payment Method (Cash / Check / Wire / Card / ACH). No new UI — the dropdown already exists.

## 2. Overdue — derive from due dates
No cron flips `sent → overdue`, so the Overdue card under-counts. Add `src/lib/invoiceStatus.ts` with an `effectiveStatus()` helper (`sent` + `due_date < today` → `overdue`) and use it in `useInvoices` totals/counts, `CollectionsView`, `AnalyticsView`, `PaidView`, `BillingPipelineTable`, `InvoiceTable`. DB stays untouched.

## 3. Needs Review — fold into Ready to Invoice
- Drop the Needs Review **card** from `InvoiceSummaryCards` (it's a look-alike twin of Overdue and confusing).
- In `BillingInboxView`, include `status='needs_review'` invoices as a fourth row kind with a yellow chip and a "Resolve & Mark Ready" action that opens the detail sheet.
- Add a `Needs Review` filter chip alongside All / Submissions / Ready / Drafts.
- The Needs Review tab in the tab strip stays (URL/filter still works) but is no longer a primary entry point.

## 4. Deposit Invoices (new)
Some clients want a formal invoice for the deposit. Add a path so Sai can issue one without the QBO/Stripe flow.

- **Where**: Add a `Create Deposit Invoice` button on the Proposal detail header (visible once the proposal is `sent` or `won`) and an entry in the project's Billing tab if no deposit invoice exists yet.
- **What it does**:
  - Creates an `invoices` row with `is_deposit = true`, `total_due = proposal.deposit_amount`, line item "Project Deposit — {proposal_number}", status `ready_to_send`, due_date = +7 days.
  - When Sai sends it, normal Send flow applies.
  - When marked Paid (or paid via Stripe), the existing `process-deposit-payment` logic also fires: creates/updates the `client_retainers` row and a `retainer_transactions` deposit entry, so it lands in the Deposits tab automatically — regardless of payment method.
- **Schema**: Add boolean `is_deposit` to `invoices` (one migration). Backfill `false`. No other column changes; the existing `retainer_id` / `retainer_applied` columns already wire deposits to retainers.
- **UI affordances**:
  - Invoice list shows a small "Deposit" badge when `is_deposit=true`.
  - In `RetainersView`, add a Source column: shows "Invoice #XXXX" (if `retainer_transactions.invoice_id` is set), "Proposal #XXXX" (parsed from notes the webhook writes), or "Manual entry."

## 5. Projects "see all" — clarify, don't change behavior
Already implemented as admin-only toggle (top-right of `/projects`, `useIsAdmin()` gated). No code change unless you tell me non-admins should also be able to see all projects — that's a permission decision, not a bug.

## 6. Changelog backfill
Add four entries to `changelog_entries` covering everything from the last few rounds that isn't logged:
- "Needs Review tab now lands on the right place" (fix)
- "Deposits tab fixed — Sai can now log Cash, Check, Wire, ACH, or Card deposits without errors" (fix)
- "Overdue is always accurate — invoices flip overdue automatically when their due date passes" (improvement)
- "Deposit invoices — issue a proper invoice for the deposit; paid deposits show up in the Deposits tab automatically" (feature)

## Files affected
- `src/hooks/useRetainers.ts`, `src/components/invoices/RetainersView.tsx` — scope profile lookup; add Source column.
- `src/lib/invoiceStatus.ts` (new) + every read site listed in §2.
- `src/components/invoices/InvoiceSummaryCards.tsx` — drop Needs Review card.
- `src/components/invoices/BillingInboxView.tsx` — add needs_review row + chip.
- `src/components/proposals/ProposalDetail*.tsx` (or the existing proposal detail page) — add `Create Deposit Invoice` button.
- `src/hooks/useInvoices.ts` — accept `is_deposit` on create; new `useCreateDepositInvoice(proposalId)` helper.
- `supabase/migrations/*` — add `invoices.is_deposit boolean default false`.
- `supabase/functions/process-deposit-payment/index.ts` — also handle invoices flagged `is_deposit=true` being marked paid manually (not just Stripe webhook path).

## Out of scope
- QBO connect/sync (you said skip).
- Changing who can see all projects (will only do if you say so).
- Reworking the proposal payment webhook beyond what §4 needs.
