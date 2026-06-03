## Goal

One unified "Add Expense" flow on a project that handles three real-world cases:

1. **PM already paid, ready to bill** → goes straight to Sai
2. **PM already paid, NOT ready to bill yet** → held on the project until released
3. **Client wants us to pay something — needs Manny/Chris approval first** → replaces the current Slack/text approval flow

## The button & modal

Keep the existing **"Add Expense"** button on the project's Services tab. Replace today's "Add Custom Service" modal with a proper expense form:

| Field | Notes |
|---|---|
| Title / Description | Same as today |
| Amount (cost) | What we paid or what client is asking us to pay |
| Markup % | Free numeric input, anyone can enter, default 0 |
| Vendor (optional) | For receipts / future QBO mapping |
| **Receipt upload** | PDF or image, stored in a private bucket |
| Bill-to contact | Defaults to project's Bill-To |
| **This expense is…** (top toggle) | ① Already paid → ready to bill · ② Already paid → hold for later · ③ Needs approval before I pay |
| Hold reason (if ②) | Short text — "waiting on CO #4", "billing at closeout", etc. |

## Three flows, one record

**① Already paid → ready to bill**
- Status: `pending_billing`
- Auto-creates a `billing_requests` row (same table service billing uses today)
- **Sai + accounting get the existing billing email** — subject includes amount, vendor, project
- Shows in Sai's Accounting Dashboard → "PM Billing Submissions" card with an "Expense" badge

**② Already paid → hold for later**
- Status: `on_hold` with reason
- No email to Sai
- Sits on project Financials tab with yellow "On Hold" pill + **"Release to billing"** button (one click → flips to flow ①)
- Surfaced on PM dashboard so it's not forgotten

**③ Needs approval first**
- Status: `pending_approval`
- **Email + in-app notification to Manny + Chris only** (approver list configurable in Settings)
- New "Approvals" inbox card on the admin dashboard with one-click **Approve** / **Deny** (deny requires reason)
- PM gets notified of decision
- On Approve → status `approved`, PM pays, comes back, clicks **"Mark as paid"** + uploads receipt → flips to flow ①
- On Deny → status `denied`, PM sees reason, can edit and resubmit

**Auto-approve threshold:** Settings → Expenses → "Auto-approve under $___" (default **$250**). Anything below skips approval and goes straight to flow ① or ②. Anything at/above requires Manny + Chris.

## Database (`project_expenses` table)

`project_id`, `service_id` (optional parent), `description`, `vendor`, `amount`, `markup_pct`, `billable_amount` (computed), `incurred_date`, `receipt_url`, `billed_to_contact_id`, `status` (`pending_approval` | `approved` | `denied` | `on_hold` | `pending_billing` | `billed` | `paid` | `non_billable`), `hold_reason`, `approval_status`, `approved_by`, `approved_at`, `denied_reason`, `invoice_line_id`, `qbo_expense_id`, `qbo_bill_id` (reserved for future QBO sync), `created_by`. RLS mirrors `services`.

## Where it shows up

- **Project → Services tab** → expenses listed alongside services with status pill, receipt link, timeline events
- **Admin Dashboard** → new "Expense Approvals" card (Manny + Chris only)
- **Accounting Dashboard** → expenses join existing "PM Billing Submissions" list with "Expense" badge
- **PM Dashboard** → "On Hold" expense count + "Awaiting your approval" if applicable
- **Project Timeline** → every state change logged ("Manny logged $450 held expense", "Chris approved $1,200 filing fee", "Sent to billing")

## Mike cleanup

Set `profiles.is_active = false` on Mike's row. Removes him from active-staff filters (bug alerts, billing notifications, OOO coverage, new assignments). All historical records he touched stay intact with his name. Reversible.

## What this does NOT change

- Change Orders still required for scope changes needing client signature
- Existing Service → Send to Billing flow untouched
- No QBO integration built in this round — just the schema columns reserved

## What I need from you to start building

1. ✅ Markup field: free numeric, anyone can enter (confirmed)
2. ✅ Receipt upload (confirmed)
3. ✅ Approval flow integrated here (confirmed)
4. **Confirm auto-approve threshold default = $250** (or tell me a different number, or "always require approval")
5. **Confirm approvers = Manny + Chris** (or any admin)
