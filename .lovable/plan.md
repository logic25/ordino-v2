

## Service Status Lifecycle: Remove "Complete", Keep "Paid"

**Current state:** The `service_status` enum has 5 values: `not_started → in_progress → complete → billed → paid`

**Desired state:** `not_started → in_progress → billed → paid`
- "Complete" is unnecessary — once work is done, the next step is billing, so services go straight from In Progress to Billed.
- "Paid" stays as the final status, tracked when the associated invoice is marked paid.

### Changes

**1. Database migration — remove "complete" from the enum**
- Create a new enum without `complete`, migrate the column, drop old enum
- Update any services currently set to `complete` → `billed`

**2. Update `auto_advance_project_phase()` function**
- Currently checks for `status IN ('completed', 'billed')` to advance project phase to closeout
- Update to check `status IN ('billed', 'paid')`

**3. Update reconciliation logic in `useProjectDetail.ts`**
- Currently jumps from `not_started` to `in_progress` (partial billing) and to `billed` (full billing)
- Add: when the associated invoice is `paid`, auto-set service status to `paid`
- No other changes needed since "complete" was never enforced in reconciliation

**4. Update `serviceStatusStyles` in `projectMockData.ts`**
- Remove `complete` entry
- Add `paid` entry with a green/success style

**5. Update `useServiceDurationReports.ts`**
- Currently filters completed services as `["complete", "billed", "paid"]`
- Update to `["billed", "paid"]`

**6. Update service status dropdown in `ProjectExpandedTabs.tsx`**
- Remove "Complete" option from any manual status selector
- Add "Paid" if not already present
- Ensure "Dropped" remains available as a manual override

