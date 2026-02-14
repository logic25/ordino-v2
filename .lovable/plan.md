
# Email System - Complete Feature Buildout

## Current State (Already Built)
- Gmail OAuth connect + sync (500 recent emails)
- Email list with split inbox tabs (All, Agencies, Clients, Urgent, Untagged, Snoozed, Archived)
- Email detail sheet with threading
- Reply and Forward with CC/BCC
- Project tagging + quick tags (with visual feedback)
- Archive, snooze, keyboard shortcuts
- Attachment preview modal (PDF/images)
- Real-time notifications (toast on new email)
- On-demand Gmail search for historical emails

## Missing Features to Build

### 1. Email Scheduling (Send Later)
Add a "Schedule Send" option next to Send in the reply/forward form.

**Database**: New `scheduled_emails` table with columns: id, company_id, user_id, email_draft (JSONB storing to/cc/bcc/subject/body/reply_to_email_id), scheduled_send_time, timezone, status (scheduled/sent/cancelled/failed), project_id, gmail_message_id, sent_at, created_at. RLS policy scoped to company.

**Edge Function**: New `gmail-schedule-send` cron-style function (or reuse `gmail-send` with a scheduled flag). A separate edge function `process-scheduled-emails` will query for due emails and send them via the Gmail API.

**UI Changes**:
- Add a dropdown button next to "Send" with quick options: "Tomorrow 9 AM", "Monday 9 AM", custom date/time picker
- New `ScheduleSendDropdown` component with a calendar + time picker
- Add "Scheduled" tab to `EmailFilterTabs`
- Show scheduled emails in-list with countdown badge and edit/cancel actions

### 2. Email Reminders ("Remind if no reply")
**Database**: New `email_reminders` table: id, email_id, company_id, user_id, remind_at, condition (no_reply/absolute_date), status (pending/reminded/cancelled), created_at.

**Edge Function**: `process-email-reminders` checks for due reminders, looks for thread replies, auto-cancels if replied, otherwise creates a notification.

**UI Changes**:
- Add "Set Reminder" button in email detail action bar
- Dropdown: "If no reply in 1 day / 3 days / 1 week / Custom date"
- Show reminder badge on emails in list view
- Reminder indicator in email detail sheet

### 3. Compose New Email (not just reply/forward)
Currently users can only reply or forward. They cannot compose a brand new email.

**UI Changes**:
- Add "Compose" button in the emails page header
- New `ComposeEmailDialog` modal with To, CC/BCC, Subject, Body fields
- Reuse `gmail-send` edge function (no reply_to_email_id)
- Option to tag to a project before sending

### 4. Internal Email Notes
The `email_notes` table already exists but has no UI.

**UI Changes**:
- Add a collapsible "Team Notes" section in `EmailDetailSheet`
- Show existing notes with author + timestamp
- Text input to add a new note
- New `useEmailNotes` hook for CRUD

### 5. Email Assignment
The `assigned_to`, `assigned_by`, `assigned_at` columns already exist on the emails table.

**UI Changes**:
- Add "Assign" button in email detail action bar
- Dropdown showing team members (from profiles table)
- Show assignee badge in email list and detail view
- Filter tab or badge for "Assigned to me"

### 6. Drafts Support
**Database**: Add `is_draft` boolean and `draft_data` JSONB to `emails` table (or use `scheduled_emails` with status='draft').

**UI Changes**:
- "Save Draft" button in compose/reply form
- "Drafts" tab in email filter tabs
- Resume editing a draft

### 7. Mark as Read/Unread
The `is_read` column exists but there's no toggle in the UI.

**UI Changes**:
- Add "Mark as unread" action in email detail
- Visual distinction (bold) for unread emails in the list
- Unread count badge on the Email nav item in sidebar

---

## Implementation Order

**Phase 1 (this session):**
1. Compose New Email dialog
2. Email Scheduling (Send Later) with scheduled tab
3. Internal Email Notes UI
4. Mark as Read/Unread toggle + visual indicator

**Phase 2 (next session):**
5. Email Reminders (remind if no reply)
6. Email Assignment
7. Drafts support

---

## Technical Details

### New Database Tables

```text
scheduled_emails
+---------------------+------------------+
| column              | type             |
+---------------------+------------------+
| id                  | uuid PK          |
| company_id          | uuid FK          |
| user_id             | uuid FK          |
| email_draft         | jsonb            |
| scheduled_send_time | timestamptz      |
| timezone            | text             |
| status              | text             |
| project_id          | uuid FK nullable |
| gmail_message_id    | text nullable    |
| sent_at             | timestamptz null |
| created_at          | timestamptz      |
+---------------------+------------------+

email_reminders
+---------------------+------------------+
| column              | type             |
+---------------------+------------------+
| id                  | uuid PK          |
| email_id            | uuid FK          |
| company_id          | uuid FK          |
| user_id             | uuid FK          |
| remind_at           | timestamptz      |
| condition           | text             |
| status              | text             |
| reminded_at         | timestamptz null |
| cancelled_at        | timestamptz null |
| created_at          | timestamptz      |
+---------------------+------------------+
```

### New Files
- `src/components/emails/ComposeEmailDialog.tsx`
- `src/components/emails/ScheduleSendDropdown.tsx`
- `src/components/emails/EmailNotesSection.tsx`
- `src/components/emails/ReminderButton.tsx`
- `src/hooks/useEmailNotes.ts`
- `src/hooks/useScheduledEmails.ts`
- `supabase/functions/process-scheduled-emails/index.ts`

### Modified Files
- `src/components/emails/EmailDetailSheet.tsx` - add notes section, read/unread toggle, reminder button
- `src/components/emails/EmailList.tsx` - unread styling, reminder badge, assignee indicator
- `src/components/emails/EmailFilterTabs.tsx` - add Scheduled tab
- `src/pages/Emails.tsx` - add Compose button, scheduled tab handling
- `src/hooks/useEmails.ts` - add scheduled email queries
- `supabase/config.toml` - register new edge function
