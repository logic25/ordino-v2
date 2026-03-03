

# Fix "Sent to Billing" Data + Consolidate Invoice Tabs

## Problem 1: "Sent to Billing" Shows Empty

The billing request workflow auto-creates an invoice AND immediately flips the request to "invoiced" status, so nothing ever appears as "pending" in the Sent to Billing tab. Items sent by PMs skip the accounting review step entirely.

**Fix**: Stop auto-advancing billing requests to "invoiced." They stay "pending" until accounting explicitly reviews and creates the invoice from the new "To Invoice" tab.

## Problem 2: Too Many Tabs (13 tabs)

Current: All | Ready to Send | Needs Review | Sent | Overdue | Paid | Legal Hold | Collections | Promises | Retainers | Sent to Billing | Schedules | Analytics

**New structure (7 tabs):**

| New Tab | What It Replaces |
|---------|-----------------|
| **To Invoice** | Merges "Sent to Billing" + "Ready to Send" + "Needs Review" -- accounting's work queue |
| **Sent** | Same as today |
| **Overdue** | Merges "Overdue" + "Collections" (keeps AI reminders, risk scoring) |
| **Paid** | Same as today |
| **Retainers** | Same as today |
| **Schedules** | Same as today |
| **Analytics** | Same as today |

"Legal Hold," "Promises," and "Draft" become status badges or filters within the relevant tabs instead of separate top-level tabs.

---

## Technical Details

### 1. Fix billing request workflow (`src/hooks/useBillingRequests.ts`)
- Remove auto-creation of invoice inside `useCreateBillingRequest`
- Billing request stays `pending` until accounting acts on it
- Add a new mutation to "Create Invoice from Request" that creates the invoice and marks the request as `invoiced`

### 2. Create `BillingInboxView` component (replaces `BillingSentTable`)
- Shows all pending billing requests as actionable rows
- Each row: Project, Services, Amount, Submitted By, Date
- Actions: Review, Create Invoice, Reject
- Bulk "Create All Invoices" button for batch processing

### 3. Update `InvoiceFilterTabs.tsx`
- Reduce tab list from 13 to 7
- Rename the merged intake tab to "To Invoice"
- Add count badge showing number of pending billing requests

### 4. Merge Collections into Overdue tab
- Remove separate "Collections" tab entry
- `CollectionsView` already renders for overdue -- keep collections tools (AI reminders, risk scoring) within the single Overdue tab
- Move "Promises" into the Overdue view as a sub-section

### 5. Update `Invoices.tsx`
- Wire up new 7-tab structure
- Route "To Invoice" tab to the new `BillingInboxView`
- Remove references to deleted tab values
- Update type definitions for `BillingTab`

