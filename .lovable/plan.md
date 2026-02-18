

# Three-Part Enhancement: Google Login, Reports Page, and Sidebar Polish

## 1. Google Sign-In (OAuth)

Add a "Sign in with Google" button to the Auth page alongside the existing email/password form. This uses Lovable Cloud's managed Google OAuth -- no API keys or configuration needed.

### What changes
- **Configure social auth**: Use the Lovable Cloud social auth tool to generate the Google OAuth integration module at `src/integrations/lovable/`
- **Auth page (`src/pages/Auth.tsx`)**: Add a "Sign in with Google" button above the email/password form with a visual divider ("or continue with email"). The Google button will be visually prominent since it's the preferred method
- **Auth hook (`src/hooks/useAuth.tsx`)**: No changes needed -- the OAuth flow redirects back and the existing `onAuthStateChange` listener picks up the session automatically
- **Setup flow**: After Google sign-in, new users without a profile still get redirected to `/setup` as usual

### User experience
- Google button appears first (preferred), followed by an "or" divider, then the email/password form
- Existing email/password login continues to work unchanged
- Password reset flow is unaffected

---

## 2. Dedicated Reports Page

A new `/reports` route with a comprehensive reporting hub organized by category. Given the feature-rich nature of the app, reports will cover Projects, Billing, Time, Proposals, and Operations.

### Report categories and specific reports

**Projects**
- Project Status Summary: breakdown by status (active, on hold, completed), with counts and aging
- Checklist Completion Rate: % completion across all projects, flagging stalled ones
- Application Pipeline: DOB applications by status, avg processing time

**Billing / Invoices**
- Revenue Summary: monthly revenue, collected vs outstanding, trend chart
- Aging Report: invoices grouped by 0-30, 31-60, 61-90, 90+ days
- Collections Performance: collections rate, avg days to pay, promise-kept rate (extends existing AnalyticsView data)

**Time**
- Utilization Report: hours logged per team member, billable vs non-billable
- Project Hours: total hours per project with budget comparison
- Weekly Summary: hours by day/week for the team

**Proposals**
- Win Rate: proposals sent vs executed vs lost, conversion funnel
- Pipeline Value: total value of pending proposals
- Follow-Up Effectiveness: avg follow-ups before conversion

**Operations**
- Client Activity: projects per client, revenue per client
- Team Workload: projects assigned per PM, upcoming deadlines

### What changes
- **New page (`src/pages/Reports.tsx`)**: Tab-based layout with the 5 categories above. Each tab shows relevant report cards with charts (using recharts, already installed)
- **New components in `src/components/reports/`**: Individual report components for each category
- **New hook (`src/hooks/useReports.ts`)**: Aggregation queries pulling from existing tables (projects, invoices, time_entries, proposals)
- **Routing (`src/App.tsx`)**: Add `/reports` protected route
- **Sidebar (`src/components/layout/AppSidebar.tsx`)**: Add "Reports" nav item with the existing BarChart3 icon
- **Permissions**: Use the existing `reports` resource key (already defined in the permissions system but currently disabled for all roles). Enable for admin and accounting roles

---

## 3. Relocate Sidebar Collapse Button

The collapse toggle currently sits at the very bottom of the sidebar below the Sign Out button, which feels disconnected. Move it to the sidebar header area next to the logo.

### What changes
- **Sidebar (`src/components/layout/AppSidebar.tsx`)**:
  - Remove the collapse button from the footer section
  - Add a small collapse/expand icon button in the header row, aligned to the right of the logo
  - When collapsed, the button shows the expand chevron in the same header position
  - Sign Out button remains in the footer alone, cleaner layout

---

## Technical Details

### Files created
| File | Purpose |
|------|---------|
| `src/pages/Reports.tsx` | Main reports page with category tabs |
| `src/components/reports/ProjectReports.tsx` | Project status, checklist, application reports |
| `src/components/reports/BillingReports.tsx` | Revenue, aging, collections reports |
| `src/components/reports/TimeReports.tsx` | Utilization, project hours, weekly summary |
| `src/components/reports/ProposalReports.tsx` | Win rate, pipeline, follow-up reports |
| `src/components/reports/OperationsReports.tsx` | Client activity, team workload |
| `src/hooks/useReports.ts` | Data aggregation hook for report queries |

### Files modified
| File | Change |
|------|---------|
| `src/pages/Auth.tsx` | Add Google sign-in button with divider |
| `src/components/layout/AppSidebar.tsx` | Move collapse button to header, add Reports nav item |
| `src/App.tsx` | Add `/reports` route |

### Implementation order
1. Google OAuth setup (configure social auth tool + Auth page update)
2. Sidebar collapse button relocation
3. Reports page scaffold with tabs
4. Individual report components (one category at a time)

### Database changes
- A migration to seed the `reports` resource in `role_permissions` for admin and accounting roles (enabled with full access)

