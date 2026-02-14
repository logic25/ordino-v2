

# Complete Team Detail View + Role Permissions System

## Summary

This plan consolidates everything discussed across multiple conversations into one implementation. There are three major workstreams: (A) fix the team detail stat cards and metrics, (B) add the employee reviews system and enhanced edit form, and (C) build the granular role permissions system with visibility controls.

---

## Part A: Corrected Stat Cards with Tooltips

### What's Wrong Today
- **Billing %** calculates billable minutes / total minutes. Should be: **revenue billed vs. monthly goal** (e.g., $27K billed / $39K goal = 69%)
- **Timelog Completion** divides by estimated business days. Should use: **attendance_logs** (days with time entries / days clocked in)
- **Efficiency Rating** divides billable minutes by 8hr standard. Should be: **weighted composite** of multiple metrics
- **Potential Bonus** is hardcoded at $5/hr if >75%. Should be: **progressive tiers based on goal attainment**
- **No tooltips** explaining what each card means

### Corrected Metric Formulas

| Card | New Formula | Tooltip |
|---|---|---|
| Billing % | `sum(invoices.total_due where project.assigned_pm_id = user) / profiles.monthly_goal x 100` | "Revenue billed on your projects vs. your monthly goal" |
| Non-Billable COs | Shows $0 (placeholder until change orders table exists) | "Dollar value of change orders caused by mistakes that couldn't be billed to the client" |
| Timelog Completion | `distinct days with time entries / distinct days clocked in (from attendance_logs) x 100` | "Of the days you clocked in, what % had time logged? PTO/sick days excluded" |
| Accuracy | Shows "N/A" (placeholder until estimated dates on services) | "How accurate your estimated completion dates are vs. actual. Available when estimated dates are added to services" |
| Efficiency Rating | Weighted composite: Billing 40%, Timelog 30%, Accuracy 25%, CO 5%. When Accuracy is N/A, redistributes proportionally | "Weighted composite of your performance metrics. Weights are configurable" |
| Potential Bonus | Progressive tiers based on Billing %: 0-99% = $0, 100-110% = $250, 111-125% = $500, 126%+ = $1,000 | "Estimated bonus based on monthly billing goal attainment" |

### Billing Chart (Enhanced)
- 12-month bar chart using Recharts (already installed)
- Three series: Billed (green bars), Estimated (yellow bars), Monthly Goal (line)
- Year dropdown to compare different years
- Summary table below chart: Year, Month, QTY (invoice count), Amount, Goal, Goal %

### Proposals Tab (Enhanced)
- Summary stat cards at top: Total Written, Converted, Conversion Rate, Total Value
- Year/period dropdown for comparison
- Existing proposals table below

---

## Part B: Employee Reviews + Expanded Edit Form

### New Database Table: `employee_reviews`

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK companies | Multi-tenant isolation |
| employee_id | uuid FK profiles | Person being reviewed |
| reviewer_id | uuid FK profiles | Manager writing the review |
| review_period | date | Month/quarter being reviewed |
| overall_rating | numeric | 0-100 composite score |
| previous_rating | numeric | Snapshot from prior period |
| category_ratings | jsonb | e.g., `{"Technical Knowledge": 4, "Quality of Work": 3}` |
| comments | text | Free-form feedback |
| created_at / updated_at | timestamptz | |

RLS: company-isolated reads/writes. Unique constraint on `(employee_id, review_period)`.

### Reviews Tab Change
Currently shows client reviews this user *authored*. Changes to show **performance reviews OF this employee** written by managers. Includes:
- "Add Review" button (admin/manager only)
- Review dialog: period picker, category rating table (uses existing `review_categories` from settings), overall rating, previous rating auto-populated, comments
- Each review displays as a card with category breakdown, reviewer name, and period

### New Profile Columns

| Column | Type | Purpose |
|---|---|---|
| monthly_goal | numeric | Dollar target per month (critical for Billing %) |
| about | text | Bio/description |
| carrier | varchar | Mobile carrier |
| job_title | varchar | Position title |

### Expanded Edit Form (Two Columns)

**Left column:** First Name, Last Name, Email (read-only), About (textarea)

**Right column:** Job Title, Role (dropdown), Monthly Goal ($), Hourly Rate ($/hr), Mobile Number + Extension, Carrier, Active/Inactive toggle, Signature preview + upload

---

## Part C: Granular Role Permissions

### Current State
- `user_roles` table exists with `app_role` enum: `admin`, `production`, `accounting`
- `useUserRoles.ts` hook exists with `useIsAdmin()`, `useCanAccessBilling()`, etc.
- Sidebar shows all nav items to all users (no filtering)
- No `role_permissions` table exists yet

### New Database Table: `role_permissions`

| Column | Type | Default | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| company_id | uuid FK | | Multi-tenant |
| role | app_role | | admin / production / accounting |
| resource | varchar | | e.g., "projects", "invoices", "users" |
| enabled | boolean | false | Can access this resource at all? |
| can_list | boolean | false | Can see the list view? |
| can_show | boolean | false | Can view individual records? |
| can_create | boolean | false | Can create new records? |
| can_update | boolean | false | Can edit existing records? |
| can_delete | boolean | false | Can delete records? |

Unique constraint on `(company_id, role, resource)`. RLS: company-isolated, only admins can update.

### Default Permission Seeds

**Resources**: dashboard, projects, properties, proposals, invoices, time_logs, emails, calendar, documents, clients, settings, users, roles, reports

| Role | Full Access | Read-Only | No Access |
|---|---|---|---|
| admin | Everything | -- | -- |
| production | projects, properties, proposals, time_logs, calendar, documents, dashboard | invoices, clients | users, roles, settings, reports |
| accounting | invoices, time_logs, clients, dashboard | projects, proposals | properties, users, roles, settings, reports |

A database seed function initializes these defaults per company. Called on first access or company creation.

### Roles Settings UI
New "Roles" card in Settings page. The UI matches the legacy screenshots:
- Tabs or dropdown to select role (Admin is read-only/all-on to prevent lockout)
- Table with rows = resources, columns = Enabled | List | Show | Create | Update | Delete
- Switch toggles for each cell
- Saves immediately on toggle

### Team Detail Visibility Rules

**Employee viewing their own profile (non-admin):**
- Profile card: read-only (no edit button)
- Stats: can see their own Billing %, Timelog, Efficiency, Bonus
- Tabs: can see their own Proposals and Projects
- Cannot see: hourly rate, other users' detail views, edit controls, role dropdown
- Reviews: can see reviews of themselves (read-only)

**Admin/Manager viewing any profile:**
- Full edit form with all fields
- All stats visible including hourly rate
- Can write employee reviews
- Can change roles, active status
- Can view any team member

**Non-admin viewing another user:**
- Blocked -- clicking other users in the list does nothing (or shows limited public info like name/role/phone)

### Sidebar Enforcement
`AppSidebar.tsx` uses the new `usePermissions` hook to filter nav items. If `canAccess("invoices")` is false for a production user, the Billing nav item is hidden.

### Route Guard Enforcement
`ProtectedRoute` in `RouteGuards.tsx` accepts an optional `resource` prop. If the user lacks access, redirects to dashboard with a toast message.

---

## Technical Details

### Database Migrations

**Migration 1: Profile columns**
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS monthly_goal numeric,
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS carrier varchar,
  ADD COLUMN IF NOT EXISTS job_title varchar;
```

**Migration 2: Employee reviews table**
```sql
CREATE TABLE employee_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  employee_id uuid NOT NULL REFERENCES profiles(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  review_period date NOT NULL,
  overall_rating numeric,
  previous_rating numeric,
  category_ratings jsonb DEFAULT '{}',
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, review_period)
);

ALTER TABLE employee_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing is_company_member function
CREATE POLICY "Company members can view reviews"
  ON employee_reviews FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage reviews"
  ON employee_reviews FOR ALL TO authenticated
  USING (is_company_admin(company_id));
```

**Migration 3: Role permissions table + seed**
```sql
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  role app_role NOT NULL,
  resource varchar NOT NULL,
  enabled boolean DEFAULT false,
  can_list boolean DEFAULT false,
  can_show boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  UNIQUE(company_id, role, resource)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS: company members can read, admins can write
CREATE POLICY "Company members can view permissions"
  ON role_permissions FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Admins can manage permissions"
  ON role_permissions FOR ALL TO authenticated
  USING (is_company_admin(company_id));

-- Seed function to initialize defaults for a company
CREATE OR REPLACE FUNCTION seed_role_permissions(target_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- Inserts default permission rows for admin/production/accounting
-- across all 14 resources
$$;
```

### New Files

| File | Purpose |
|---|---|
| `src/hooks/useEmployeeReviews.ts` | CRUD hook for employee_reviews table |
| `src/hooks/usePermissions.ts` | Fetch role_permissions, provide canAccess/canList/canCreate/canUpdate/canDelete helpers |
| `src/components/settings/RolesSettings.tsx` | Permission matrix UI with toggle table |

### Modified Files

| File | Change |
|---|---|
| `src/components/settings/TeamSettings.tsx` | Rewrite billing stats hook (goal-based), add tooltips to StatCard, add billing chart, enhance proposals tab with summary cards, replace reviews tab with employee reviews, expand edit form to two columns with all new fields, add self-view vs admin-view visibility logic |
| `src/pages/Settings.tsx` | Add "Roles" section to settings menu (new section type + card) |
| `src/components/layout/AppSidebar.tsx` | Filter nav items using usePermissions hook |
| `src/components/routing/RouteGuards.tsx` | Add optional `resource` prop for permission-based route guarding |
| `src/hooks/useProfiles.ts` | Add `useAllCompanyProfiles()` that includes inactive users |

### Implementation Order
1. Database migrations (profile columns, employee_reviews, role_permissions + seed)
2. `usePermissions` hook + `useEmployeeReviews` hook
3. TeamSettings.tsx -- corrected metrics, tooltips, billing chart, expanded edit form, employee reviews tab, visibility rules
4. RolesSettings.tsx -- permission matrix UI
5. Settings.tsx -- add Roles section
6. AppSidebar.tsx -- filter nav items by permissions
7. RouteGuards.tsx -- permission-based route blocking

