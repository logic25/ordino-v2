

## Fix: 400 error on invoices query in AppLayout.tsx

**Problem**: `AppLayout.tsx` line 67 queries `total_amount` and `paid_amount` from the `invoices` table, but those columns don't exist. The actual columns are `total_due` and `payment_amount`.

**Fix**: One edit in `src/components/layout/AppLayout.tsx`:
- Line 67: Change `.select("total_amount, paid_amount, status")` to `.select("total_due, payment_amount, status")`
- Lines 151-152: Update the reducer references from `inv.total_amount` → `inv.total_due` and `inv.paid_amount` → `inv.payment_amount`

This is the same pattern as the previous BillingGoalTracker fix — code referencing column names that don't match the actual schema.

