

## Enrich Bug Tracker with Management UI + Notifications

### What we're solving
Right now, when Chris (or anyone) submits a bug report, nobody gets alerted. The bug list is also view-only with no way to manage status, assign, or comment. This plan adds full management capabilities plus both in-app and email notifications.

---

### 1. Database Migration

**Add columns to `feature_requests`:**
- `updated_at` (timestamptz, default now)
- `resolved_at` (timestamptz, nullable)
- `assigned_to` (uuid, FK to profiles.id, nullable)
- `admin_notes` (text, nullable)

**Add an RLS policy** so admins can update any bug in their company (currently only the reporter can update their own).

**Add a trigger function** `notify_bug_report_activity()` that fires on INSERT and UPDATE:
- **On INSERT**: inserts a notification row for every active profile in the same company (except the reporter), with type `bug_reported`, title like "New Bug: [title]", and link to `/help`
- **On status change to resolved**: notifies the original reporter

**Enable realtime** on `feature_requests` so the list updates live.

---

### 2. Email Alerts via Edge Function

**Create `supabase/functions/send-bug-alert/index.ts`:**
- Called by the trigger via `pg_net` (or called client-side after mutation)
- Looks up all company profiles with Gmail connections
- Sends a brief email via the existing `gmail-send` function pattern: subject "Bug Report: [title]", body with page/priority/description
- Simpler approach: call it client-side from `BugReports.tsx` after successful submit, passing the bug details — the edge function emails all company admins

---

### 3. Rebuild `BugReports.tsx` UI

**Summary stats bar** at top: Open | In Progress | Resolved | Critical counts

**Filter toolbar:**
- Status filter: All / Open / In Progress / Resolved
- Priority filter: All / Critical / High / Medium / Low
- Sort: Newest / Oldest / Priority

**Table layout** replacing cards:
- Columns: Status icon, Title, Priority badge, Assigned To, Date, Actions
- Click row to expand detail panel

**Management actions (admin only):**
- Change status dropdown: open → in_progress → resolved (sets `resolved_at` on resolve)
- Assign to team member (dropdown of company profiles)
- Admin notes textarea
- Delete bug

**Reporter actions:**
- Edit own bugs (title, description, priority)

---

### 4. In-App Notification Wiring

The database trigger handles inserting into the `notifications` table automatically. The existing `NotificationDropdown` component + realtime subscription will pick them up — no frontend changes needed for the bell icon.

Add `bug_reported` to the `typeIcons` map in `NotificationDropdown.tsx` with the `Bug` icon.

---

### Files changed
- **New migration**: Add columns, RLS policy, trigger function
- **New edge function**: `supabase/functions/send-bug-alert/index.ts`
- **`src/components/helpdesk/BugReports.tsx`**: Full rebuild with table, filters, management
- **`src/components/notifications/NotificationDropdown.tsx`**: Add bug icon to type map

