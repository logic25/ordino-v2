

# Merge Chris + Cleanup + Auto-Join

## Current State

| User | Email | Company | Issue |
|------|-------|---------|-------|
| Manny | manny@greenlightexpediting.com | Green Light Expediting LLC | user_role points to non-existent company |
| erussell25 | erussell25@gmail.com | Green Light Expediting LLC | Fine -- keeping as-is |
| Chris | chris@greenlightexpediting.com | "Green Light Expediting-Chris" (duplicate) | Wrong company, needs admin |
| test@test.com | test@test.com | "Green Light Expeditings" (duplicate) | Removing |

3 duplicate companies exist: "Green Light Expediting-Chris", "Green Light Expeditings", "Test Direct Insert". They contain some stale data (4 projects, 4 proposals, 7 clients, attendance logs, etc.) that will be cleaned up.

## Plan

### Step 1: Data operations (using insert tool, not migration)

In a specific order to respect FK constraints:

1. **Move Chris** -- Update his `profiles` row to `company_id = 01993413-...` and `role = 'admin'`
2. **Update Chris's user_role** -- Point to correct company, set role to `admin`
3. **Fix Manny's user_role** -- Currently points to non-existent company `99d5c902-...`, update to `01993413-...`
4. **Delete test@test.com's profile and user_role**
5. **Delete role_permissions** for the 3 duplicate companies
6. **Delete all child data** (projects, proposals, clients, attendance, notifications, etc.) from the 3 duplicate companies
7. **Delete the 3 duplicate companies**: "Green Light Expediting-Chris", "Green Light Expeditings", "Test Direct Insert"

### Step 2: Database migration -- `auto_join_existing_company` function

Create a SECURITY DEFINER function that:
- Checks if user already has a profile (returns existing company_id if so)
- Finds the single existing company
- Creates a `staff` profile and `admin` user_role (since right now all team members are admin-level)
- Returns the company_id

### Step 3: Rewrite `src/pages/Setup.tsx`

Remove the company creation form entirely. Replace with a loading screen that:
- On mount, extracts first/last name from Google OAuth `user_metadata` (or email prefix as fallback)
- Calls `auto_join_existing_company` RPC
- On success: `refreshProfile()` then navigates to `/dashboard`
- On error: shows a toast and redirects to `/auth`

No form, no inputs -- just an automatic "Setting up your account..." spinner.

## Files Changed

| File | Change |
|------|--------|
| Data operations | Move Chris, fix Manny's role, delete test data + duplicate companies |
| New migration | `auto_join_existing_company` function |
| `src/pages/Setup.tsx` | Replace form with auto-join loading screen |

## Result

- Chris appears in Settings > Team as admin with full access
- Manny, erussell25, and Chris all under Green Light Expediting LLC
- test@test.com profile removed (auth record stays but has no access)
- Any future user who signs in auto-joins the company as staff

