# Finish Expense Wiring

Scope: complete what was started for the unified expense + approval flow. No dashboard changes this round (we'll tackle a login-screen "Upcoming Work" widget on the main Dashboard next, per your note).

## 1. Approval email trigger
In `useCreateExpense` (in `useProjectExpenses.ts`), after inserting an expense with `status = pending_approval`, invoke the existing `send-expense-approval-request` edge function with: expense id, project name/number, vendor, amount, requester, receipt URL, and approver email list (Manny + Chris from settings). Function already exists — just needs to be called.

## 2. Admin "Expense Approvals" inbox
New component on the Admin/Production Dashboard (`src/pages/Dashboard.tsx` or its admin section): a card titled **Expense Approvals (N)** showing every expense where `approval_status = pending`. Each row:
- Project # + name (linked)
- Description + vendor
- Amount + markup % + billable total
- Requester avatar + name
- Receipt thumbnail/link (signed URL)
- **Approve** / **Deny (with reason)** buttons → calls `useApproveExpense` / `useDenyExpense`
- Auto-approve badge if amount < company threshold

Visible only to admins (Manny + Chris). Uses `usePendingExpenseApprovals` hook (already exists).

## 3. Receipt viewer
Inline thumbnail in:
- Approvals inbox (above)
- The `ExpensesSection` list on the Services tab
- A "View receipt" link that opens the signed URL in a new tab (use `getReceiptSignedUrl`)

## 4. Accounting queue badge
In `src/components/dashboard/AccountingDashboard.tsx` (PM Billing Submissions section), join `billing_requests` → `project_expenses` via `billing_request_id`. When a row originated from an expense, show an amber **Expense** badge next to the project name plus vendor in the description.

## 5. Settings UI for threshold + approvers
Add to `src/pages/Settings.tsx` under a new **Expenses** section:
- Numeric input: "Auto-approve threshold ($)" — writes to `companies.settings.expense_auto_approve_threshold` (column already added)
- Multi-select of admin profiles: "Approvers" — writes to `companies.settings.expense_approvers` (array of profile ids; new settings JSON key, no schema change needed)
- Default approvers = Manny + Chris if unset

The edge function and `useCreateExpense` read approvers from settings (falling back to all admins).

## 6. Decision routing on approve
When an admin clicks Approve in the inbox:
- `approval_status → approved`, `status → approved`
- In-app notification to the requesting PM: "Your expense for {vendor} was approved — pay it and mark as paid to release for billing"
- PM sees a "Mark as Paid" button on their expense row → flips status to `pending_billing`, which fires the existing trigger to create a `billing_request` row → Sai gets the standard billing email (no change to that path)

When Deny:
- `approval_status → denied`, `status → denied`, `denied_reason` saved
- In-app notification to requester with reason
- Requester can edit and resubmit (status flips back to `pending_approval`)

## Technical notes
- All changes client-side + one edge function call; no schema migrations needed (table, threshold column, and storage bucket already exist)
- `usePendingExpenseApprovals` already exists in `useProjectExpenses.ts`
- Notifications use the existing `notifications` table — no new types beyond `expense_pending_approval`, `expense_approved`, `expense_denied`
- RLS on `project_expenses` already filters by company; approval visibility gated client-side by admin role check

## Out of scope (next round)
- Dashboard "Upcoming Work" widget for login screen (pipeline health, pending approvals, on-hold, approved-unbilled by PM) — noted, will tackle separately
- QuickBooks mapping (columns `qbo_expense_id` / `qbo_bill_id` already reserved)
