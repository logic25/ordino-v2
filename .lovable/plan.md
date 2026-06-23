# Gate Content to admins via `role_permissions`

Recommendation: **add `content` as a real resource in `role_permissions`**. It's the same pattern as every other page, costs one extra row per role in the already-cached single query (5 min staleTime, ~zero perf impact), and lets you grant Content to a Manager later from Settings → Roles without touching code.

## Why not the hard-coded `isAdmin` shortcut

It works, but you'd be the only page in the app that bypasses the permissions table. Next time someone says "let the Marketing Manager use Content too," it's a code change + deploy instead of a checkbox in Settings. Not worth the savings, since there are no savings — the permissions query is one round-trip per session either way.

## Changes

### 1. Add the resource (frontend constants)
`src/hooks/usePermissions.ts`
- Extend `ResourceKey` union with `"content"`.
- Add `{ key: "content", label: "Content" }` to `ALL_RESOURCES` so it shows up in the Settings → Roles grid.

### 2. Seed `role_permissions` rows (migration — DDL-free, pure inserts)
Per the project's data-vs-schema rule, I'll do this with the **insert tool**, not a schema migration:
- For every existing `(company_id, role)` pair, insert one row with `resource = 'content'`:
  - `admin`: `enabled = true`, all CRUD true
  - everyone else: `enabled = false`, all CRUD false
- Use `ON CONFLICT DO NOTHING` (or equivalent) so re-running is safe.

Also need the seed to fire for **new companies/roles created after this change**. Two options:
- (a) extend the existing role-seeding trigger/function (whichever already seeds default permissions for a new role) to include `content`, or
- (b) leave new roles to inherit the default-false behavior and rely on the Settings UI.

I'll check whether a seeder function exists during build and pick (a) if it does, (b) otherwise. No new triggers invented.

### 3. Gate the sidebar
`src/components/layout/AppSidebar.tsx` line 67
- Change `resource: "dashboard"` → `resource: "content"` on the Content nav item. Existing sidebar filter (`canAccess(resource)`) does the rest — non-admins stop seeing it.

### 4. Gate the route
`src/pages/Content.tsx`
- At the top: `const { canAccess, loading } = usePermissions();`
- If `!loading && !canAccess("content")` → redirect to `/` (or render a small "Not authorized" state, matching how other gated pages handle it — I'll match the existing convention found in the codebase).

### 5. Verify
- Log in as admin → Content visible + accessible.
- Log in as a non-admin role → Content hidden in sidebar, direct nav to `/content` redirects.
- Settings → Roles → toggle Content on for "Manager" → that user sees it without a deploy.

## Cost note
The `useRolePermissions` query is already cached for 5 minutes per session and pulls all rows in one call. Adding one row per role per company is well within noise. No new queries, no new round-trips, no schema migration.

## Files touched
- `src/hooks/usePermissions.ts` (add `content` to union + `ALL_RESOURCES`)
- `src/components/layout/AppSidebar.tsx` (change resource key on Content item)
- `src/pages/Content.tsx` (route-level gate)
- Data seed via insert tool (rows in `role_permissions`); optional edit to existing role-seed function if one exists

## Out of scope
- No changes to `role_permissions` schema.
- No changes to RLS on content tables (those already check `company_id` + role server-side; this PR is UI-layer gating, which is the same layer every other resource uses).
