## Quick answers (no code)

**Projects → "Paid"** = projects whose invoices are fully paid. The project lifecycle is `open → closed → paid`. Closed means work is done; Paid means the final invoice cleared.

**Projects → "Stale"** = an **open** project with no activity (no time logged, no notes, no status change, no email/comment) for **14+ days** (per-project threshold defaults to 14, set on the project). It's a nudge, not a real status — the project is still `open`, it's just been quiet.

I'll add a "?" tooltip on both tabs so this is visible to anyone.

---

## Admin Dashboard fix

You want the same at-a-glance proposal-conversion view the old Ordino had: monthly rows showing how many proposals went out, how many converted, the rate, and the dollars. We already have a "Proposals Pipeline" card (bars by stage), but no monthly conversion table — that's what's missing.

### New widget: **Proposal Conversion Rates**
A table on the admin dashboard, last 12 months by default:

| Month | Sent | Converted | Rate | Proposed $ | Converted $ |
|-------|------|-----------|------|------------|-------------|
| Jun 2026 | 15 | 4 | 26.7% | $77,775 | $11,875 |
| May 2026 | 38 | 26 | 68.4% | $196,500 | $110,400 |
| … | | | | | |
| **Total** | 192 | 120 | **62.5%** | $1.6M | $750k |

**Definitions**
- **Sent** = proposals where `sent_at` falls in that month (status `sent`, `signed_client`, `executed`, or `won`).
- **Converted** = proposals from that same month-of-send whose status reached `signed_client`/`executed`/`won` (so the rate reflects the cohort, not just signatures that happened to land in that month — matches how you used to read the old report).
- **Rate** = Converted ÷ Sent.
- **Proposed $** = sum of `total_amount` of all Sent proposals.
- **Converted $** = sum of `total_amount` of converted proposals.

**Controls**
- Year selector (defaults to current year, options for current + 2 prior).
- Click a month row → navigates to `/proposals?status=sent&month=YYYY-MM` so you can drill in.
- Totals row at the bottom.

### Tooltips on existing dashboard cards
Add short hover explainers to **Proposals Pipeline** (what each stage means) and the **KPI tiles** so nothing feels mysterious.

## Files
- `src/hooks/useDashboardData.ts` — add `useProposalConversionRates(year)` (single Supabase query over `proposals`, bucketed in JS by month).
- `src/components/dashboard/ProposalConversionTable.tsx` — new widget (table + year picker).
- `src/components/dashboard/AdminCompanyView.tsx` — drop it in just below `ProposalsPipelineCard` (and add it to the layout-config registry so it can be toggled).
- `src/hooks/useDashboardLayout.ts` (or the widget list file) — register `proposal-conversion-rates`.
- `src/pages/Projects.tsx` — small `?` tooltip on the Paid and Stale tab triggers.
- `changelog_entries` — one row: "Admin Dashboard: monthly proposal conversion rates."

## Out of scope
- Reworking the Pipeline card itself (it stays — it's the live "where are deals right now" view; the new table is the historical "how are we converting").
- Filtering by source/PM (can add later if you want — flag it after you see the table).
- Charts. Table only for now to match the old layout you referenced.

No DB migration needed.
