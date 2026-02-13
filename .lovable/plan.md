

# Email Productivity Features - Phase 1 Implementation Plan

This is a large feature set. To keep things stable and testable, the plan is broken into **3 implementation phases**. This plan covers **Phase 1** (core productivity), with Phases 2 and 3 following after testing.

---

## Phase 1 Scope (This Plan)

1. **Smart Inbox Filters** (Split inbox tabs with counts)
2. **Quick Tag System** (DOB, FDNY, etc. with auto-tagging)
3. **Archive Functionality** (Hide processed emails)
4. **Snooze Functionality** (Delay emails until later)
5. **Keyboard Shortcuts** (Navigation + actions + help overlay)
6. **Email Status Indicators** (Visual glanceable state)

## Phase 2 (Next Plan)
- Bulk Actions with multi-select
- Internal Email Notes with @mentions
- Team Assignment

## Phase 3 (Later)
- Google Chat Webhook Notifications
- Notification preferences

---

## Database Changes

A single migration adds all needed columns and a new table:

### New columns on `emails` table:
- `tags TEXT[]` - Quick tag labels (DOB, FDNY, OBJECTION, etc.)
- `snoozed_until TIMESTAMPTZ NULL` - Hide until this time
- `archived_at TIMESTAMPTZ NULL` - Soft-archive timestamp
- `assigned_to UUID NULL` - Team member assignment (for Phase 2, added now to avoid future migration)
- `assigned_by UUID NULL`
- `assigned_at TIMESTAMPTZ NULL`
- `replied_at TIMESTAMPTZ NULL` - Tracks if user replied

### New indexes:
- GIN index on `tags` for array filtering
- Partial indexes on `snoozed_until`, `archived_at`, `assigned_to`

### New table: `email_notes` (for Phase 2, schema added now)
- `id UUID PK`
- `email_id UUID REFERENCES emails(id) ON DELETE CASCADE`
- `company_id UUID NOT NULL`
- `user_id UUID NOT NULL`
- `user_name TEXT NOT NULL`
- `note_text TEXT NOT NULL`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- RLS: company isolation (same pattern as other tables)

---

## Feature Details

### 1. Smart Inbox Filter Tabs

A horizontal tab bar replaces the current "Untagged only" toggle:

**Tabs:** All | Agencies | Clients | Urgent | Untagged | Snoozed | Archived

- **Agencies**: `from_email` matches `@nyc.gov`, `@buildings.nyc.gov`, `@fdny.nyc.gov`, `@dep.nyc.gov`, `@lpc.nyc.gov`, `@planning.nyc.gov`
- **Clients**: Has at least one `email_project_tags` entry
- **Urgent**: Subject/snippet contains keywords (objection, disapproved, violation, deadline, etc.)
- **Untagged**: No `email_project_tags`
- **Snoozed**: `snoozed_until > NOW()`
- **Archived**: `archived_at IS NOT NULL`

Each tab shows a count badge. Filters combine with the search bar.

**Files:** New `EmailFilterTabs.tsx` component, updated `Emails.tsx` and `useEmails.ts`

### 2. Quick Tag System

Color-coded labels (separate from project tags) stored in `emails.tags` array:

| Tag | Color | Auto-detect Rule |
|-----|-------|-----------------|
| DOB | Blue | from/to contains `@buildings.nyc.gov` or `@nyc.gov` + "DOB" |
| FDNY | Red | from/to contains `@fdny.nyc.gov` |
| DEP | Green | from/to contains `@dep.nyc.gov` |
| LPC | Purple | from/to contains `@lpc.nyc.gov` |
| OBJECTION | Orange | subject/body contains objection/disapproved |
| APPROVAL | Green | subject/body contains approved/approval |
| INSPECTION | Yellow | subject/body contains inspection/inspect |
| FILING | Indigo | subject/body contains filing/filed |
| CLIENT | Gray | Has project tag |

**Auto-tagging**: Runs client-side when emails load (compares current tags vs rules, updates if needed). A bulk "Auto-tag all" button available for initial setup.

**UI**: Toggle buttons in email detail sheet, badge display in email list (max 3 + overflow).

**Files:** New `QuickTagSection.tsx`, `useQuickTags.ts` hook, updated `EmailList.tsx`

### 3. Archive Functionality

- New `archived_at` column (timestamp, null = not archived)
- Main inbox query: `WHERE archived_at IS NULL`
- Archive button in email detail sheet + "E" keyboard shortcut
- "Archived" filter tab to view/unarchive
- Archived emails still visible in project email tabs

**Files:** Updated `useEmails.ts`, `EmailDetailSheet.tsx`

### 4. Snooze Functionality

- New `snoozed_until` column
- Main query: `WHERE (snoozed_until IS NULL OR snoozed_until <= NOW())`
- Snooze dropdown with presets: Tomorrow 9AM, In 3 Days, Next Monday, Custom
- "Snoozed" filter tab shows snoozed emails with return date
- Unsnooze button to clear

**Files:** New `SnoozeMenu.tsx` component, updated `useEmails.ts`, `EmailDetailSheet.tsx`

### 5. Keyboard Shortcuts

Global listener (skipped when typing in inputs):

| Key | Action |
|-----|--------|
| `/` | Focus search |
| Up/Down | Navigate email list |
| Enter | Open selected email |
| Esc | Close detail sheet |
| `P` | Open tag dialog |
| `R` | Focus reply |
| `E` | Archive email |
| `?` | Show shortcuts help |

**Files:** New `useEmailKeyboardShortcuts.ts` hook, new `KeyboardShortcutsDialog.tsx`, updated `Emails.tsx` and `EmailList.tsx` (to support highlighted/focused state separate from selected)

### 6. Email Status Indicators

Right side of each email list item shows small icons:

- Attachment icon (already exists)
- Project count badge (blue, e.g. "2")
- Unread dot (blue circle)
- Urgent dot (red, if matches urgent keywords)
- Replied indicator (if `replied_at` is set)

**Files:** Updated `EmailList.tsx`

---

## Technical Notes

- All filtering uses client-side logic on the already-fetched 500 emails (avoids complex server queries for array/text matching). Server-side `WHERE archived_at IS NULL` is the only server filter addition.
- Tag mutations use optimistic updates via React Query for instant UI.
- The `replied_at` column gets set by the existing reply flow in `useSendEmail`.
- Quick tags are stored directly on the `emails` row (simple `TEXT[]` array update), not in a separate table.
- Keyboard shortcuts check `document.activeElement?.tagName` to avoid firing when typing.

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/components/emails/EmailFilterTabs.tsx` | Horizontal filter tab bar with counts |
| `src/components/emails/QuickTagSection.tsx` | Toggle buttons for quick tags in detail sheet |
| `src/components/emails/SnoozeMenu.tsx` | Snooze dropdown with preset options |
| `src/components/emails/KeyboardShortcutsDialog.tsx` | Help overlay showing all shortcuts |
| `src/hooks/useEmailKeyboardShortcuts.ts` | Global keyboard event handler |
| `src/hooks/useQuickTags.ts` | Auto-tag logic + tag mutation |

## Modified Files

| File | Changes |
|------|---------|
| `src/pages/Emails.tsx` | Add filter tabs, keyboard shortcuts, highlighted email state |
| `src/hooks/useEmails.ts` | Add archive/snooze filters, new filter types, archive/snooze mutations |
| `src/components/emails/EmailList.tsx` | Quick tag badges, status indicators, highlight state, checkbox prep |
| `src/components/emails/EmailDetailSheet.tsx` | Quick tags section, snooze button, archive button |

