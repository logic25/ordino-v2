

# Fix Team Overview Click + Eliminate Setup Flash

## Two Issues Found

### 1. Team Overview card is not clickable
The `TeamOverview` component on the dashboard is just a display card with no click handler or navigation. You'd expect clicking it to take you to **Settings > Team & Users** to manage the team, but it doesn't do anything.

**Fix**: Make the card header or a "Manage Team" button link to `/settings?section=team`.

### 2. Setup page flashes on login
When you sign in with email/password, there's a race condition: the auth state updates immediately but the profile fetch is async (deferred with `setTimeout`). During that gap, `hasProfile` is `false`, so the `ProtectedRoute` briefly redirects to `/setup` before the profile loads and sends you to the dashboard.

**Fix**: In `useAuth.tsx`, keep `loading = true` until the profile fetch completes on initial session restore. The `ProtectedRoute` already shows a loading screen while `loading` is true, so this eliminates the flash entirely. The Setup page itself is fine (it auto-joins), but users should never see it flash.

## Changes

### `src/components/dashboard/TeamOverview.tsx`
- Add `useNavigate` from react-router-dom
- Make the card clickable with `onClick={() => navigate("/settings?section=team")}` and add a cursor-pointer class
- Add a "Manage Team" button in the header that also navigates there

### `src/hooks/useAuth.tsx`
- Remove the `setTimeout` wrapper around the profile fetch in `onAuthStateChange` -- it causes `loading` to flip to `false` before the profile is fetched, creating the flash
- Instead, only set `loading = false` after the profile fetch resolves (which is already the pattern used in the `getSession` block)
- This ensures `ProtectedRoute` shows the loading spinner until the profile is confirmed present or absent

## Technical Details

In `useAuth.tsx`, the current `onAuthStateChange` handler does:
```js
setTimeout(() => {
  fetchProfile(...).then(() => setLoading(false));
}, 0);
```

The `setTimeout` was added to "avoid deadlock," but the actual issue it solves is Supabase's warning about not calling Supabase methods inside the auth callback synchronously. Using `setTimeout(..., 0)` still defers it, but the problem is that `setLoading(false)` can fire from the `getSession` path before the `onAuthStateChange` path's profile fetch completes. The fix ensures both paths wait for profile fetch before setting loading to false, and avoids the double-fetch race.

