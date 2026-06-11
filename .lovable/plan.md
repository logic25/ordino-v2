# Unified "Ready to Invoice" Worklist

## Problem

The Ready to Invoice tab currently shows three separate tables stacked on top of each other (PM Submissions, Ready to Send, Drafts). It looks like three different screens glued together and forces Sai to scan three lists instead of one.

## Goal

One table. One row per item. A status chip tells you what kind of thing it is. A single primary button on each row moves it to the next step. The header total still matches the card.

## What the row types mean (terminology, for the tooltip + empty state)

- **Submission** — A PM sent services over via "Send to Billing." No invoice exists yet. Next step: create the invoice.
- **Draft** — An invoice that was created and parked (either via "Save as Draft" in Create Invoice, or by editing a finalized invoice back to draft). Next step: finish it and mark it ready.
- **Ready** — A finalized invoice waiting to be emailed to the client. Next step: send.

## The new layout

```text
Ready to Invoice                                       [Create Invoice]
21 items · $32,100.00 ready to bill

[ All 21 ] [ Submissions 12 ] [ Ready 8 ] [ Drafts 1 ]      Sort: Oldest first ▾

┌────────┬──────────────┬──────────────────────────┬──────────┬──────────┬──────────────┐
│ Status │ Date         │ Client / Project         │ Services │   Amount │ Action       │
├────────┼──────────────┼──────────────────────────┼──────────┼──────────┼──────────────┤
│ ●Sub   │ 04/29/2026   │ Rudin · 2026-0722        │ ALT-2 D14│ $100.00  │ Create Inv ▸ │
│ ●Ready │ 04/21/2026   │ SL Green · 2026-0728     │ ALT-2 D14│ $750.00  │ Send ▸       │
│ ●Draft │ 04/15/2026   │ Brookfield · 2026-0701   │ Filing   │ $1,200.00│ Finish ▸     │
│ …                                                                                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Rules

1. **One table, three row sources merged client-side**, sorted by oldest `created_at` first so the staleness of submissions and drafts is visible alongside ready invoices.
2. **Status chip** colors: Submission = amber, Draft = muted/gray, Ready = primary/blue. Chip is also the filter — clicking a chip at the top filters the table.
3. **One primary action per row** based on type:
   - Submission → `Create Invoice` (existing `useCreateInvoiceFromRequest` flow)
   - Draft → `Finish` (opens `InvoiceDetailSheet` so she can edit + mark ready)
   - Ready → `Send` (opens `SendInvoiceModal`)
4. **Row click** on any row opens the matching detail/expansion (submission expands inline like today; invoices open `InvoiceDetailSheet`).
5. **Secondary actions** live in a `⋯` menu per row: Reject (submissions), Delete (drafts), View invoice (ready). Keeps the row clean.
6. **Header** shows the combined count + total so it equals the "Ready to Invoice" card. Subtitle: `12 submissions · 8 ready · 1 draft`. Filter chips also show per-bucket counts.
7. **Bulk action** stays: when one or more Submissions are selected, the existing `Create All Invoices` button appears in the header. Selection only enables bulk for compatible row types.
8. **Empty state**: one friendly "All caught up — nothing to invoice" instead of three empty boxes.

## Files affected

- `src/components/invoices/BillingInboxView.tsx` — rewrite from three sections to one unified table. Merge `useBillingRequests("pending")` + `useInvoices("draft")` + `useInvoices("ready_to_send")` into a single sorted array of `{ kind, id, date, client, project, services, amount, raw }`.
- No changes needed to `InvoiceSummaryCards`, `useInvoices`, `useBillingRequests`, or `InvoiceFilterTabs` — the totals/counts wiring done last turn already lines up.

## Out of scope

- No DB / migration changes.
- No changes to how submissions get created, how drafts are edited, or how invoices are sent — only the list UI changes.
- No change to the Sent / Overdue / Paid tabs.

## Changelog

Add a `changelog_entries` row: "Billing → Ready to Invoice is now one unified worklist with a status chip per row and a single next-step action, instead of three stacked tables."
