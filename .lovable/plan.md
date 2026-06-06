# Fix Sentry errors triage

Three Sentry errors were reported. Investigation results:

## 1. `ROLES is not defined` — `InviteMemberDialog.tsx` ✅ Already fixed
The component now loads roles dynamically via `useCustomRoles()` and the `ROLES` constant no longer exists anywhere in `src/`. The Sentry event is from an older release captured mid-refactor. **No code change needed** — will mark resolved in Sentry.

## 2. `Cannot read properties of undefined (reading 'replace')` — `AppSidebar.tsx` ✅ Already fixed
The current code separates `NavItem` from `NavGroup` via a `"kind" in entry` check (line 224) and only calls `item.href.replace(...)` after that narrowing. All entries in `mainNav` and `secondaryNav` have hard-coded `href` values, and `filteredMainNav` preserves the group/item shape. The Sentry event fired during an HMR cycle on the same release; current source is sound. **No code change needed** — will mark resolved in Sentry.

## 3. `Rendered more hooks than during the previous render` — `PropertyDetail.tsx` ⚠️ Real bug, needs fix
Root cause: hook order violates the Rules of Hooks.

- Line ~452: early return `if (!property) return <NotFound/>;`
- Line 510: `const coJobCount = useMemo(...)` runs **after** that early return

On the first render `property` is undefined → component returns early → `useMemo` never runs. When the query resolves and `property` becomes defined, React sees an extra `useMemo` call vs the previous render and throws.

### Fix
Move `coJobCount = useMemo(...)` (and any other hooks living below the `if (!property) return` / `if (isLoading) return` guards) above those early returns. The `useMemo` body already handles `coApps` being an empty array, so no other change is required.

Quick audit of the file will be done while editing to catch any other hook below the guards (e.g. additional `useMemo`/`useCallback` defined later in the body). Any found will be hoisted in the same edit.

## Out of scope
- No changes to AppSidebar or InviteMemberDialog (verified clean).
- No refactor of PropertyDetail beyond hoisting hooks above early returns.
- No new tests (single localized fix).

## Verification
- After edit, visit `/properties/:id` in the preview for a property that loads cleanly — no console error.
- Mark all three Sentry findings resolved.

## Changelog
Add a `changelog_entries` row: *"Fixed a rare crash on the Property detail page caused by an internal hook ordering issue."*
