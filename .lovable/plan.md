# Fix: admins still can't edit team members

## Diagnosis

The previous migration created the sync function but the **backfill never landed** — `user_roles` is empty for all three admins (Mike, Manny, Chris). `useIsAdmin()` reads from `user_roles`, so the row click handler in `TeamSettings.tsx` treats them as non-admins (`canClick = false`, edit disabled).

```
profiles.role = 'admin'   user_roles = (none)   →   useIsAdmin() = false
```

Same root cause blocks Service Catalog edits and the new admin-only Reports tabs.

## Fix

Single migration:

1. **Backfill** `user_roles` for every profile where `role = 'admin'`:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin'::app_role FROM public.profiles WHERE role = 'admin'
   ON CONFLICT (user_id, role) DO NOTHING;
   ```
2. **Ensure the sync trigger is actually attached** to `profiles` (drop-if-exists then create), so future role changes stay in sync.
3. Verify with a `SELECT` that all three admins now have a row.

## Out of scope

No frontend changes needed — once `user_roles` has the rows, the existing `useIsAdmin()` hook unlocks editing on Team, Service Catalog, and admin Reports tabs.
