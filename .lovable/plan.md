# Fix Executed Status Display & Modernize Proposal Summary Cards

## Problem 1: 021726-4 Shows "Executed" Instead of Project Number

Proposal `021726-4` has status `executed` but `converted_project_id` is NULL -- meaning no project was created when it was marked as approved/executed. The table code in `ProposalTable.tsx` only shows the green project number badge when `converted_project?.project_number` exists, otherwise it falls back to the plain "Executed" badge.

**Fix:** Two changes needed:

- **Data fix:** If the proposal was legitimately executed, either create the project or link it. We'll add a "Convert to Project" action in the dropdown menu for executed proposals that are missing a linked project, so you can fix this and any future cases.
- **Visual indicator:** When an executed proposal has no linked project, show the "Executed" badge with a small warning icon and a tooltip saying "No project linked -- use menu to convert." - there should be no condition where the proposal is exectuted and a project is NOT created

## Problem 2: Modernize Summary Cards with Month-over-Month Trends 

In the legacy system i look at the number of proposals mom/yoy to see or find trends and acitivty, i aslo look at the amounts if we have less but there are bigger. Inspired by the legacy Ordino screenshot, replace the current 5 simple count cards with richer analytics cards that show:


| Card                | Primary Value                                 | Detail Line            | Trend Arrow         |
| ------------------- | --------------------------------------------- | ---------------------- | ------------------- |
| **Total Proposals** | Count this month                              | Total value this month | vs last month count |
| **Sent / Awaiting** | Count sent this month                         | Dollar value awaiting  | vs last month       |
| **Conversion Rate** | % executed out of decided                     | Won count / Lost count | vs last month rate  |
| **Revenue Won**     | Dollar value of executed proposals this month | Executed count         | vs last month       |
| **Follow-ups Due**  | Count overdue                                 | "Need attention"       | (no trend)          |


Each card (except Follow-ups) shows a small green up-arrow or red down-arrow with the delta vs. the previous month, calculated from `created_at` dates in the proposal data.

## Technical Steps

### 1. ProposalTable.tsx -- Executed badge with missing project handling

- When `status === "executed"` and no `converted_project`, show the Executed badge with an `AlertTriangle` icon
- Add a "Convert to Project" dropdown menu item for executed proposals without a linked project (calls existing conversion logic or opens the approval dialog)

### 2. Proposals.tsx -- Modernize summary cards

- Extract month-over-month stats from `displayProposals` using `date-fns` (`startOfMonth`, `subMonths`, `isWithinInterval`)
- Calculate: this month count, last month count, delta, value totals, conversion rate
- Replace the current 5 `Card` blocks with a reusable card layout showing:
  - Primary metric (large number)
  - Secondary detail (small text)
  - Trend indicator: up/down arrow with percentage or absolute change, colored green/red
- Keep the click-to-filter behavior on each card
- Keep the Follow-ups Due card with its destructive styling when overdue

### 3. ProposalTable.tsx -- "Convert to Project" menu item

- For executed proposals where `converted_project_id` is null, add a dropdown item with `FolderOpen` icon labeled "Convert to Project"
- This triggers `onMarkApproved` (the existing approval flow that creates the project and links it)

## Files to Edit


| File                                         | Change                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `src/pages/Proposals.tsx`                    | Rewrite summary cards section with month-over-month trend logic             |
| `src/components/proposals/ProposalTable.tsx` | Add warning on executed-without-project, add "Convert to Project" menu item |
