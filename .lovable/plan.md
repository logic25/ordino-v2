

# Revised Plan: Notification Settings + Complexity-Weighted PM Capacity

## Key Revisions from Previous Plan

**1. Notification Preferences move to Settings page (not Profile)**
A new "Notifications" section in the Settings page where users configure all notification preferences -- billing digests, email alerts, project updates, etc.

**2. PM Billing Goal uses complexity-weighted capacity, not project count**
A PM with 60 "Pull Permit" projects has very different capacity than a PM with 60 "Alt-1" or "CO" projects. The system will assign a **complexity weight** to each service in the Service Catalog, then calculate a PM's weighted workload to determine their available billing capacity.

---

## 1. Notification Settings (New Settings Section)

### What it does
A new card in the Settings page called "Notifications" where users can configure:
- **Billing Submissions**: Realtime / Daily Summary / Weekly Summary
- **Project Updates**: When assigned, when checklist items change
- **Proposal Activity**: New proposals, status changes
- **Email Alerts**: New emails, follow-up reminders
- **System Alerts**: Feature request updates, product news

Each category has a toggle (on/off) and a frequency selector (Realtime / Daily / Weekly).

### How it works
- Stores preferences in the user's `profiles` row using a `notification_preferences` JSONB column (new)
- The notification dropdown in the TopBar continues to work as-is; this just controls what generates notifications and how they're batched
- No changes to ProfileSettings -- notification config lives purely in the new Settings section

### Files
- **New**: `src/components/settings/NotificationSettings.tsx` -- The full notification preferences UI
- **Modified**: `src/pages/Settings.tsx` -- Add "Notifications" card with Bell icon to the settings sections list
- **Database**: Add `notification_preferences` JSONB column to `profiles`

---

## 2. Complexity-Weighted PM Billing Capacity

### The Problem
Counting projects is misleading. A PM with 60 small "Pull Permit" jobs looks overloaded but has far more billing headroom than a PM with 20 "Alt-1" filings that each require extensive coordination.

### The Solution

**Step A: Add complexity weight to Service Catalog**
Each service type in the catalog gets a `complexity_weight` field (numeric, 1-10 scale):
- Pull Permit = 1
- TCO Renewal = 2
- Alt-2 = 3
- Alt-1 = 5
- CO = 6
- Full new building = 8

Admins configure these weights in Settings > Proposals & Services alongside existing service pricing.

**Step B: Calculate Weighted Workload per PM**
For each PM, look at their active projects and the services attached to each project. Sum the complexity weights of all active services. This gives a "Weighted Workload Score."

**Step C: Smart Billing Target**
- Define a company-wide "max weighted capacity" per PM (configurable, e.g., 100 points)
- Calculate: `Utilization % = (PM's weighted workload) / max capacity`
- Billing target = based on the dollar value of their active services scaled by checklist readiness
- Example: PM has services worth $50K total, average 60% readiness = ~$30K should be billable

**Step D: Dashboard Display**
The `BillingGoalTracker` component (on Admin and Manager dashboards) shows per PM:
- Weighted workload score (e.g., 72/100)
- Number of projects (for context, but de-emphasized)
- Service mix breakdown (e.g., "12 Pull Permits, 3 Alt-1s, 2 COs")
- Billed this month vs. smart target
- Progress bar with color coding

### Files
- **Modified**: `src/hooks/useCompanySettings.ts` -- Add `complexity_weight` to `ServiceCatalogItem` interface
- **Modified**: `src/components/settings/ServiceCatalogSettings.tsx` -- Add complexity weight column to service table
- **New**: `src/components/dashboard/BillingGoalTracker.tsx` -- PM billing capacity cards
- **Modified**: `src/hooks/useDashboardData.ts` -- Add `usePMBillingGoals` hook that queries projects, their checklist items, and joins with service catalog weights
- **Modified**: `src/components/dashboard/AdminCompanyView.tsx` -- Add BillingGoalTracker
- **Modified**: `src/components/dashboard/ManagerView.tsx` -- Add BillingGoalTracker
- **Modified**: `src/components/settings/TeamSettings.tsx` -- Add "max weighted capacity" field per team member

---

## 3. Remaining Items (Unchanged from Previous Plan)

These items carry forward as-is:

- **Accounting Dashboard**: Submissions-by-PM summary with invoice status tracking
- **Proposal Reports**: Year multi-select for comparison chart, activity trend lines
- **Project Reports**: Rename "Application Pipeline" to "DOB Application Status"
- **Help Desk Page**: `/help` route with How-To Guides, What's New, and Feature Requests tabs
- **Data Exports Tab**: CSV export cards for all major data tables
- **Referrals Tab**: Top referrers table and source pie chart

---

## Technical Details

### Database Migration

```sql
-- Notification preferences on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';
```

The `feature_requests` table migration from the previous plan also applies.

### New Files

| File | Purpose |
|------|---------|
| `src/components/settings/NotificationSettings.tsx` | Notification preference toggles and frequency selectors |
| `src/components/dashboard/BillingGoalTracker.tsx` | Complexity-weighted PM billing capacity cards |
| `src/pages/HelpDesk.tsx` | Help desk page |
| `src/components/helpdesk/HowToGuides.tsx` | Searchable guides |
| `src/components/helpdesk/WhatsNew.tsx` | Changelog |
| `src/components/helpdesk/FeatureRequests.tsx` | Feature request form and list |
| `src/components/reports/ReferralReports.tsx` | Referral analytics |
| `src/components/reports/DataExports.tsx` | CSV exports |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Add "Notifications" section |
| `src/hooks/useCompanySettings.ts` | Add `complexity_weight` to ServiceCatalogItem |
| `src/components/settings/ServiceCatalogSettings.tsx` | Add complexity weight column |
| `src/components/settings/TeamSettings.tsx` | Add max weighted capacity field |
| `src/components/dashboard/AdminCompanyView.tsx` | Add BillingGoalTracker |
| `src/components/dashboard/ManagerView.tsx` | Add BillingGoalTracker |
| `src/components/dashboard/AccountingView.tsx` | Submissions-by-PM summary |
| `src/hooks/useDashboardData.ts` | PM billing goals hook with complexity weighting |
| `src/pages/Reports.tsx` | Add Referrals and Exports tabs |
| `src/components/reports/ProposalReports.tsx` | Year selector and trend lines |
| `src/components/reports/ProjectReports.tsx` | Rename Application Pipeline |
| `src/App.tsx` | Add `/help` route |
| `src/components/layout/AppSidebar.tsx` | Add Help nav item |

### Implementation Order
1. Database migration (notification_preferences column + feature_requests table)
2. Notification Settings component + add to Settings page
3. Add complexity_weight to service catalog interface and settings UI
4. Build BillingGoalTracker with weighted capacity logic
5. Accounting dashboard submissions-by-PM
6. Proposal Reports year selector and trend lines
7. Project Reports rename
8. Referral Reports and Data Exports tabs
9. Help Desk page with all tabs
10. Sidebar and routing updates
