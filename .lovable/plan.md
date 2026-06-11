# Admin Access, Conversion CO Column, Tooltips

Tackling items 1–4 from the open list. Digest (#7), Pro Cert (#5), and Prediction Accuracy dashboard (#6) stay parked.

## 1. Fix admin access (root cause — affects #3 and #4)

**Diagnosis:** 3 users have `profiles.role = 'admin'` (Mike, Manny, Chris) but **zero rows in `user_roles`**. The `useIsAdmin()` hook and most RLS policies key off `user_roles`, not `profiles.role` — so these admins are silently treated as staff. That's why team-member profiles aren't clickable and Service Catalog edits get blocked by RLS.

**Fix:**
- One-time data backfill: insert a `user_roles` row with `role = 'admin'` for every profile where `profiles.role = 'admin'` and no admin user_role exists, scoped to their `company_id`.
- Add a DB trigger on `profiles` insert/update so any future profile flipped to `role = 'admin'` automatically gets a matching `user_roles` row (and removed when demoted). Prevents this drift from recurring.
- No frontend changes needed — the gates already work, they just had no data.

## 2. Proposal Conversion table — add "Converted COs" column (#1)

In `ProposalConversionTable.tsx` → `ProposalsTab`:
- Extend `useProposalConversionRates` to also query `change_orders` for the same year (filter by `company_id`, `client_signed_at` not null, sum `amount`). Bucket by `client_signed_at` month.
- Add `convertedCOValue` to `ProposalConversionRow`.
- New column **"Change Orders $"** between "Converted $" and end, with month subtotals + year total. Match legacy column position.
- Row click stays the same (links to `/proposals?month=...`).

## 3. Service Catalog admin edit (#4)

Once #1's backfill lands, admins will pass the company RLS update policy and saves will succeed. Add a small belt-and-braces UI guard:
- In `ServiceCatalogSettings.tsx`, gate "Add Service", "Save", and inline edit buttons on `useIsAdmin()`. Non-admins see a read-only view with a tooltip "Admin only". No silent failures.

## 4. Tooltips on major tables (#2)

Reuse the existing `<InfoTooltip>` pattern already in `ProposalConversionTable`. Add a header-cell helper (`<TableHeadWithTip>`) and apply it to:
- **Dashboard:** Proposal Conversion, Billing by User (already partially done), Open Services, Action Items
- **Projects** list, **Properties** list, **Clients** list, **Proposals** list, **Invoices** list, **RFPs** list, **Change Orders** list, **Service Catalog** table

Each column gets a one-line plain-English definition (what it is, how it's computed when not obvious). I'll write the copy as I go — no separate review step.

## Out of scope

- Pro Cert flag, Prediction Accuracy dashboard, weekly digest delivery — all parked per your last message.
- Settings tables that aren't user-facing (e.g. role permissions matrix) — not "major".

## Files

- **Migration:** backfill `user_roles` + trigger function
- **Edit:** `src/hooks/useDashboardData.ts` (add CO query to conversion hook)
- **Edit:** `src/components/dashboard/ProposalConversionTable.tsx` (new column)
- **Edit:** `src/components/settings/ServiceCatalogSettings.tsx` (admin gates)
- **New:** `src/components/ui/table-head-with-tip.tsx` (helper)
- **Edit:** ~10 table list components for tooltip headers
- **Changelog:** one entry per shipped item
