

## Make "What's New" Database-Driven with Admin CRUD

### Database
- Create `changelog_entries` table: `id`, `company_id`, `date`, `title`, `description`, `tag` (feature/improvement/fix), `loom_url`, `created_by`, `created_at`
- RLS: authenticated company members can SELECT; admins can INSERT/UPDATE/DELETE
- Seed migration with the 12 existing hardcoded entries so nothing is lost

### UI Changes (`WhatsNew.tsx`)
1. Replace static `CHANGELOG` array with a Supabase query to `changelog_entries` ordered by `date desc`
2. Add "Add Entry" button (admin-only) opening a dialog with: date, title, description, tag dropdown, optional Loom URL
3. Add inline edit/delete actions on each row (admin-only)
4. Keep existing month-grouping, collapse/expand, and tag badge rendering unchanged

### Files
- **New migration** — create table, RLS policies, seed data
- **`src/components/helpdesk/WhatsNew.tsx`** — swap data source, add admin CRUD UI

