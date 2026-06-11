## Plan

### 1. Fix admin access (urgent — blocks team member editing)

The browser is hitting `infinite recursion detected in policy for relation "user_roles"`. The `user_roles` admin policies reference `user_roles` inside their own `USING` clause, which recurses. Because that query fails, `useIsAdmin()` returns false everywhere — that's why team rows aren't clickable, Service Catalog edits are locked, Reports admin tabs are hidden, and Settings is missing admin-only sections.

- Add a migration that replaces the recursive policies on `public.user_roles` with non-recursive ones using a SECURITY DEFINER helper (`has_app_role(user_id, role)` that selects from `user_roles` with RLS bypassed).
- Keep: users can read their own roles; admins can view/manage all roles in their company.
- Verify after migration: the `/rest/v1/user_roles?...` request returns 200, Team rows become clickable, edit form saves, admin-only Reports tabs and Settings sections appear.

### 2. Gap analysis: Dashboard "Proposals & Billing" vs Reports → Proposals → Monthly Conversion

I'll write a short side-by-side note in `.lovable/plan.md` covering:
- Columns each table renders today.
- Data sources each one uses (proposal `sent_at` vs `created_at`, change-order signed dates, etc.).
- Which rows/months each one counts.
- Specifically what "more" the Reports table shows that the dashboard one doesn't (CO count column, Won $ vs Converted $ semantics, Total $ vs Proposed $, etc.).

I will not rename or remove anything from Reports.

### 3. Update the Dashboard proposal table to match the Reports Monthly Conversion view

After the gap analysis lands, update only the dashboard widget so it shows the same columns and label as Reports → Proposals → Monthly Conversion (label it "Proposal Conversion"). The Reports section is untouched.

### 4. Changelog entry

Log the admin access fix and the dashboard proposal conversion alignment in `changelog_entries`.

### Sequencing

1. Migration to fix `user_roles` recursion.
2. Verify admin UI unlocks (team edit, Settings sections, Reports tabs).
3. Write gap analysis into the plan doc.
4. Update dashboard widget to mirror Reports Monthly Conversion.
5. Insert changelog row.