## Problem
In the Billing by User tab, each month cell shows the user's billed amount and their goal for that month, but not the % of goal achieved. Only the year-end "vs Goal" column shows a %.

## Change
Add a per-month percentage to each goal-holder's monthly cell in `ProposalConversionTable.tsx`, color-coded the same way as the YTD column (red <50%, amber 50–90%, green ≥90%).

Cell layout becomes:
```
$12k         ← billed (fee)
/ $15k       ← goal (click to override, admin only)
80%          ← NEW, colored
+$500 reimb  ← if any
```

- Hide the % for future months and for months with $0 billed (show muted "—" or nothing) to avoid noisy red zeros.
- Users without a goal are unchanged (no goal, no %).

## Files
- `src/components/dashboard/ProposalConversionTable.tsx` — add the % line in the monthly cell render block (around lines 258–280).
- Changelog entry (improved): "Billing by User now shows monthly goal % per user."

## Out of scope
No data model or hook changes; `cellPct` is already computed.
