
# RFP Page: Summary Cards + Collapsible Table Cleanup

## Summary
Add win ratio and pipeline value summary cards at the top of the RFPs page, and restructure the table view to be cleaner with collapsible row details instead of cramming 10 columns into one wide table.

---

## 1. Summary Cards (new component)

Create `src/components/rfps/RfpSummaryCards.tsx` -- a row of 4 compact stat cards computed from the `rfps` data:

| Card | Value | Detail |
|------|-------|--------|
| Total RFPs | Count of all | Breakdown by active (prospect+drafting+submitted) vs closed (won+lost) |
| Win Rate | Won / (Won + Lost) as % | e.g. "2 of 5 decided" underneath |
| Pipeline Value | Sum of `contract_value` for prospect + drafting + submitted | Label: "Active Pipeline" |
| Won Value | Sum of `contract_value` for won RFPs | Label: "Secured" |

Cards use the existing `Card` component with small icons (Trophy, TrendingUp, DollarSign, Target). Values use `tabular-nums` per project conventions.

The component receives `rfps: Rfp[]` as a prop so it doesn't duplicate the query -- `Rfps.tsx` will pass the data down.

---

## 2. Collapsible Table Rows (cleaner layout)

The current table has 10 columns and doesn't fit well. Restructure to show **6 primary columns** with the rest collapsible:

**Primary row** (always visible):
- Title (clickable to expand)
- RFP # 
- Agency
- Status badge
- Due Date (with urgency indicator)
- Value

**Expanded section** (shown on click, uses Collapsible):
- Insurance requirements (badges)
- M/WBE goal
- Notes (editable inline)
- Status change action

This keeps the table compact and responsive. Clicking a row expands a detail panel below it (similar to the collapsible hierarchy pattern used in the Companies module).

---

## 3. Page Layout Update

Update `src/pages/Rfps.tsx`:
- Fetch `useRfps()` at the page level (instead of inside each view component)
- Pass `rfps` data to `RfpSummaryCards` and to the active view
- Summary cards always visible above the view toggle
- Both `RfpTableView` and `RfpKanbanBoard` accept `rfps` and `isLoading` as props

---

## Files

### Created
- `src/components/rfps/RfpSummaryCards.tsx` -- 4 stat cards

### Modified
- `src/pages/Rfps.tsx` -- lift `useRfps` up, add summary cards, pass data to children
- `src/components/rfps/RfpTableView.tsx` -- reduce to 6 columns, add collapsible expanded row with insurance/notes/M/WBE details
- `src/components/rfps/RfpKanbanBoard.tsx` -- accept `rfps` and `isLoading` as props instead of calling `useRfps` internally

---

## Technical Details

- Collapsible rows use a local `expandedIds: Set<string>` state. Clicking a row toggles its ID in the set. The expanded content renders as a second `TableRow` with `colSpan={6}` containing a grid layout of the detail fields.
- Summary card calculations are done with `useMemo` to avoid recalculating on every render.
- No database changes needed -- all data already exists in the `rfps` table.
