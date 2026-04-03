

# Fix: Performance card not updating after goal change

## Problem

When you edit a team member's Monthly Goal and save, the Performance card still shows the old Billing %. The save handler calls `refetch()` (to reload profiles) and `setSelectedUser(null)` (to go back to the list) simultaneously. When you click back into the user, the profiles list may not have finished refreshing yet, so the old `monthly_goal` value is used, and the billing stats query doesn't re-run.

## Root Cause

In `TeamSettings.tsx` line 1223:
```typescript
onUpdate={() => { refetch(); setSelectedUser(null); }}
```
`refetch()` is async but not awaited. The user can click back into the profile before the fresh data arrives.

Additionally, the billing stats query (`user-billing-stats-v2`) is cached with the old `monthlyGoal` in its key. Even if the profile refreshes, the old cached result may persist briefly.

## Fix

**File: `src/components/settings/TeamSettings.tsx`**

1. In the `handleSave` function (line 657), after a successful save, invalidate the billing stats query for that user so it re-fetches with the new goal:
   - Import `useQueryClient` and call `queryClient.invalidateQueries({ queryKey: ["user-billing-stats-v2", user.id] })` after the profile update succeeds.

2. In the `onUpdate` callback (line 1223), await the refetch before clearing the selected user:
   ```typescript
   onUpdate={async () => { await refetch(); setSelectedUser(null); }}
   ```

3. In `UserDetailView`, also invalidate billing stats from `handleSave` so the data is fresh when the user navigates back in:
   - Add `useQueryClient` to `UserDetailView`
   - After successful save, call `queryClient.invalidateQueries({ queryKey: ["user-billing-stats-v2"] })`

This ensures that when you change a monthly goal, the billing percentage recalculates immediately with the new goal value.

