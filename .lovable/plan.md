

# Fix: Wire Up Non-Billable COs Metric Using Existing Data

## Key Insight
Non-billable COs already exist as **negative change orders** created when PMs drop services. They have `amount < 0`, `status = 'approved'`, and `requested_by = 'Internal'`. No new database column is needed.

## What Changes

### 1. Add `is_non_billable` boolean to change_orders (optional but cleaner)
Rather than relying solely on negative amounts, add an explicit flag so PMs can also manually mark a positive CO as non-billable (e.g., rework we can't bill for). Default `false`. Auto-set to `true` when a dropped-service CO is created.

**Migration:**
```sql
ALTER TABLE change_orders ADD COLUMN is_non_billable boolean DEFAULT false;
```

### 2. Update ServicesFull.tsx dropped-service CO creation
When creating negative COs from dropped services, include `is_non_billable: true` in the insert.

### 3. Add "Non-billable" checkbox to CO creation/edit dialog
Simple checkbox in the CO form — "This is a non-billable change order (internal mistake)". Only visible to admins/PMs.

### 4. Wire up the Non-Billable COs StatCard in TeamSettings.tsx
Query `change_orders` where `is_non_billable = true` on the user's assigned projects in the selected period. Sum absolute values of amounts. Replace the hardcoded `$0`.

### 5. Update Efficiency Rating formula
Include the real Non-Billable CO factor (lower is better — more non-billable COs = lower score).

### 6. Add `accuracy_goal` to profiles + compute Accuracy %
- Migration: `ALTER TABLE profiles ADD COLUMN accuracy_goal numeric DEFAULT NULL`
- Add "Accuracy Goal (%)" field to the profile edit form
- Compute: services where `completed_date <= due_date` ÷ total services with both dates, for the user's assigned services
- Wire into the Accuracy StatCard

### Files Changed
| File | Change |
|------|--------|
| `change_orders` table | Add `is_non_billable` column |
| `profiles` table | Add `accuracy_goal` column |
| `src/components/projects/tabs/ServicesFull.tsx` | Set `is_non_billable: true` on dropped-service COs |
| `src/hooks/useChangeOrders.ts` | Add `is_non_billable` to types and form input |
| CO creation/edit UI components | Add non-billable checkbox |
| `src/components/settings/TeamSettings.tsx` | Wire up Non-Billable COs query, Accuracy computation, edit form field, rebalance Efficiency |

