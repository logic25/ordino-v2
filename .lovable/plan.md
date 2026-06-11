## Audit: what's mock vs real in the Team profile

`src/components/settings/TeamSettings.tsx` (1,464 lines). Tab-by-tab:

| Section | Status | Source |
|---|---|---|
| **Header card** (avatar, name, role, email, member since) | ✅ Real | `profiles` |
| **Performance cards — Billing %, Non-Billable COs, Timelog, Accuracy, Efficiency, Potential Bonus** | ⚠️ Mixed | Real query (`useUserBillingStats`) but **falls back to hardcoded `{billingPct:69, timelogCompletion:87, efficiency:72}` (line 955)** whenever the user has no goal or no real activity. That's why every empty profile shows 69/87/72. |
| **Billing tab → Monthly Billing chart** | ❌ Mock | `Math.random()` per month (line 1051–1058) when no real invoices. |
| **Billing tab → Monthly table** (QTY/Billed/Goal/Goal %) | ❌ Mock | Same random fallback. |
| **Proposals tab** (4 stat cards + table) | ✅ Real | `proposals` filtered by `sales_person_id` / `internal_signed_by`. |
| **Projects tab** (table) | ✅ Real | `projects` filtered by `assigned_pm_id` / `senior_pm_id`. |
| **Reviews tab** (review cards) | ❌ Mock | Hardcoded "Sarah Chen / Michael Torres" reviews (line 1228) when none exist. |
| **Edit form** (goals, phone, title, about) | ✅ Real | `profiles` update. |

Also already in flight from earlier turns: the **role-aware metric profile** for accounting (Sai) — Billing % + COs + Monthly Billing chart don't make sense for that role at all.

## Plan

### 1. Remove every mock fallback
- **Performance cards (line 953–957):** delete the `mockStats` object and `displayStats = hasRealData ? stats : { ...stats, ...mockStats }`. When real data is zero, render the real zero/—; never fabricate 69/87/72.
- **Monthly Billing chart + table (line 1048–1110):** delete `mockChartData` + `isMockChart`. When the year has no invoices, render an empty card ("No billing recorded for {year}") instead of randomized bars and a fake monthly table.
- **Reviews tab (line 1227–1252):** delete `mockReviews` + Sarah Chen / Michael Torres entries. When `empReviews.length === 0`, render an empty state ("No performance reviews yet" + the existing Add Review button for admins).
- Search-and-destroy any remaining `"Showing sample"` strings in this file.

### 2. Role-aware performance profile
New helper `getMetricProfile(role)` driving which cards + which Billing-tab content render:

**PM profile** — applies to `admin`, `pm`, `senior_pm`, `production`. Cards stay as today (Billing %, Non-Billable COs, Timelog, Accuracy, Efficiency, Potential Bonus). Billing tab keeps the Monthly Billing chart (real data only, empty state when none). Goal is `monthly_goal` (dollar amount, PM sales goal).

**Accounting profile** — applies to `accounting`. Cards become:
- **Invoices Issued** — count of `invoices` where `created_by = user` in period.
- **$ Invoiced** — sum of `invoices.total_due` they created.
- **Avg Time to Invoice** — average `invoices.created_at − billing_requests.created_at` (joined via `billing_request_id`).
- **Backlog** — live count of `billing_requests` with `status = 'pending'` > 2 business days old (not period-bound).
- **Collection Rate** — $ paid ÷ $ invoiced for invoices they issued aged 30+ days. (Uses existing invoice payment data.)
- **Timelog Completion** — unchanged.
- **Efficiency Rating** — weighted: Time-to-Invoice 30% + Collection 25% + Accuracy (no-disputes) 20% + Backlog cleared 15% + Timelog 10%.

Billing tab content swaps to **"Billing Activity"** for accounting:
- Monthly chart of invoices issued (count + $) by month.
- Table: Month / Invoices / $ Invoiced / Avg Time to Invoice / Disputes.
- No "monthly goal" dollar line.

**Generic profile** — any other role: only Timelog Completion + Accuracy + Member-since note. Hide $ cards.

### 3. Goals model adjustment (no schema change required up front)
- Reinterpret existing `profiles.monthly_billing_goal` based on role:
  - PM → "Monthly Billing $ Goal" (today).
  - Accounting → "Monthly Invoices Goal (count)" — label changes in the Edit form, value stored as integer in the same column.
- Add `accounting_target_hours_to_invoice` and `accounting_target_collection_pct` to the Edit form for accounting users; store in `report_settings` or a new `user_kpi_settings` row scoped per profile. Confirm with you before adding a column.
- If no goal is set, cards show raw values without % and Efficiency redistributes weights.

### 4. New-member disclosure
When `member_since < 30 days`, show a small banner above the cards explaining metrics may reflect inherited projects/requests.

### 5. Changelog
Insert `changelog_entries` row: "Team profile now shows real data only (removed sample billing chart, mock performance cards, and placeholder reviews). Accounting users are scored on invoices issued, time-to-invoice, backlog, and collections instead of PM billing."

## Open questions before build
1. **Goal storage for accounting** — okay to reuse `profiles.monthly_billing_goal` as "invoices count" when role = accounting (label flips in UI), or do you want a separate column?
2. **"Time to Invoice" target** — default to 48 business hours? You can override per user.
3. **Collection Rate window** — count invoices aged 30+ days, or 60+? (30 is industry standard for AR aging.)

## Out of scope
- Reports section, Dashboard widgets, anything outside `TeamSettings.tsx` and the underlying hooks.
- Renaming roles or changing permissions.
