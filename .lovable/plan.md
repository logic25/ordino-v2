
# Clarity Data Masking Audit — Financial & PII Fields

## What This Protects

Microsoft Clarity's Terms of Use (Section 1(b)(ii)) prohibit use in connection with financial services content. By applying `data-clarity-mask="true"` to sensitive elements, those fields are redacted as black rectangles in all session recordings and heatmaps — Clarity never captures the actual text.

## Audit Findings

The following components render financial figures, client names, contact details, and invoice data in plain, unmasked DOM text:

### 1. InvoiceTable.tsx
- Client name in client group header rows
- Dollar totals at client and project group level (e.g. `$clientGroup.totalDue`)
- Per-invoice amount cells (`$Number(inv.total_due)`)
- Contact name shown beneath invoice number (`inv.billed_to_contact.name`)

### 2. InvoiceDetailSheet.tsx (1,182 lines)
- Client name, email, phone, address (editable fields)
- Invoice total due, payment amount, retainer applied
- Line items (description, quantity, rate, amount per line)
- Follow-up notes (free-text, often contains payment amounts and contact details)
- Demand letter text area (contains full client name, amount, days overdue)
- AI-generated collection message output

### 3. InvoiceSummaryCards.tsx
- Dollar totals for Draft, Sent, Overdue, Paid, Needs Review, Retainers
- These are aggregate company financials — lower risk but still sensitive

### 4. CollectionsView.tsx
- Client name and invoice number per overdue card
- Dollar amount overdue per invoice
- Risk score badges (derived from financial analysis)
- AI-generated collection message output

### 5. PromisesView.tsx
- Client name per promise row
- Promised dollar amount (`promise.promised_amount`)
- Payment method per promise

### 6. RetainersView.tsx
- Client name per retainer
- Original amount and current balance per retainer
- Individual transaction amounts in the transaction history sheet

### 7. PaymentPlanDialog.tsx
- Total due, interest rate, installment amounts per row
- ACH authorization step (contains bank account context)
- Client name shown in dialog header

### 8. BillingReports.tsx (Reports page)
- "Top 10 Clients by Outstanding" chart — Y-axis shows client names
- Dollar figures in tooltip and bar labels
- Revenue trend chart (collected/outstanding per month)

### 9. AccountingView.tsx (Dashboard)
- KPI cards: Submissions to Bill ($), Outstanding ($), Collection Rate, Avg Days to Pay
- PM Billing Submissions list — client/project name + dollar amount per row

### 10. ReportsKPISummary.tsx
- Pending Proposal value, Open Invoice value, YTD Collected
- These are aggregate totals — moderate sensitivity

### 11. ProposalTable.tsx
- `total` column — proposal dollar value
- Client name column

### 12. ProjectExpandedTabs.tsx
- Estimated costs per discipline
- Change order amounts

## Implementation Plan

The strategy is to wrap **specific text nodes** (not whole cards/rows, which would break layout) with `<span data-clarity-mask="true">`. In table cells and inline text, the span wraps just the rendered value.

### Files to edit (12 total):

**`src/components/invoices/InvoiceTable.tsx`**
- Wrap client name in client header row
- Wrap all `$.toLocaleString()` amount cells
- Wrap billed_to_contact name

**`src/components/invoices/InvoiceDetailSheet.tsx`**
- Wrap client name, email, phone, address display text and input values
- Wrap total_due, payment_amount, retainer_applied figures
- Wrap line items table (description, rate, amount columns)
- Wrap demand letter textarea content
- Wrap follow-up notes textarea
- Wrap AI message output textarea

**`src/components/invoices/InvoiceSummaryCards.tsx`**
- Wrap the `$card.amount.toLocaleString()` text in each summary card

**`src/components/invoices/CollectionsView.tsx`**
- Wrap client name and overdue amount per card
- Wrap AI-generated message output

**`src/components/invoices/PromisesView.tsx`**
- Wrap client name, promised_amount, payment_method per table row

**`src/components/invoices/RetainersView.tsx`**
- Wrap client name, original_amount, current_balance
- Wrap transaction amounts in the sheet

**`src/components/invoices/PaymentPlanDialog.tsx`**
- Wrap totalDue, installment amounts in the preview table
- Wrap client name shown in header

**`src/components/invoices/LineItemsEditor.tsx`**
- Wrap rate and amount input values (add data-clarity-mask to the Input elements)

**`src/components/reports/BillingReports.tsx`**
- Wrap "Total Collected" dollar figure in the Collections card
- Add `data-clarity-mask="true"` to the Top Clients by Outstanding chart container (chart SVG text cannot be individually masked so the whole chart area must be masked)

**`src/components/dashboard/AccountingView.tsx`**
- Wrap KPI values: Submissions to Bill dollar amount, Outstanding dollar amount
- Wrap each billing submission row: project name, submitter name, dollar amount

**`src/components/reports/ReportsKPISummary.tsx`**
- Wrap dollar values for Pending Proposals, Open Invoices, YTD Collected

**`src/components/proposals/ProposalTable.tsx`**
- Wrap total amount cell per proposal row
- Wrap client name cell

## Technical Notes

- `data-clarity-mask="true"` can be applied to any HTML element — Clarity replaces its text content with `*` characters in recordings
- For Recharts SVG-based charts (like the Top Clients bar chart), individual `<text>` SVG nodes cannot be targeted with `data-clarity-mask`. The correct approach is to wrap the entire `ResponsiveContainer` with a `<div data-clarity-mask="true">` — this masks the whole chart area in recordings while preserving full functionality in the live UI
- Input fields need `data-clarity-mask="true"` on the `<input>` element itself; the shadcn `<Input>` component accepts and passes through arbitrary HTML attributes, so this works without component modification
- No visual changes to users — masking is invisible in the live app and only affects Clarity recordings
