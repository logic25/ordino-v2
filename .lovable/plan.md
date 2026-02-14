
# Email System - Complete Feature Buildout

## Current State (Already Built)
- Gmail OAuth connect + sync (deep sync on first connect ~500 msgs, incremental after)
- Email list with split inbox tabs (Inbox, Agencies, Clients, Urgent, Sent, Snoozed, Archived, Scheduled)
- Email detail sheet with threading
- Compose, Reply, and Forward with CC/BCC + file attachments
- Project tagging + quick tags (with auto-suggest)
- Archive, snooze, mark read/unread, keyboard shortcuts
- Attachment preview modal (PDF/images)
- Real-time notifications (toast on new email)
- On-demand Gmail search for full history
- Email scheduling (Send Later) with scheduled tab
- Internal team notes on emails
- Recipient autocomplete from CRM + Gmail history

## Phase 2 (Next)

### 1. Email Reminders ("Remind if no reply")
**Database**: New `email_reminders` table: id, email_id, company_id, user_id, remind_at, condition (no_reply/absolute_date), status (pending/reminded/cancelled), created_at, reminded_at, cancelled_at.

**Edge Function**: `process-email-reminders` checks for due reminders, looks for thread replies, auto-cancels if replied, otherwise creates a notification.

**UI Changes**:
- Add "Set Reminder" button in email detail action bar
- Dropdown: "If no reply in 1 day / 3 days / 1 week / Custom date"
- Show reminder badge on emails in list view
- Reminder indicator in email detail sheet

### 2. Drafts Support
**Database**: Add `is_draft` boolean and `draft_data` JSONB to `emails` table (or use `scheduled_emails` with status='draft').

**UI Changes**:
- "Save Draft" button in compose/reply form
- "Drafts" tab in email filter tabs
- Resume editing a draft

---

## Roadmapped (Future)
- **Email Assignment** — assign emails to team members with assignee badges
- **Date range picker** for email search UI
- **Two-way read/unread sync** with Gmail (requires gmail.modify scope)

---

## Technical Details

### New Database Tables

```text
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
- `src/components/emails/ReminderButton.tsx`
- `src/hooks/useEmailReminders.ts`
- `supabase/functions/process-email-reminders/index.ts`

### Modified Files
- `src/components/emails/EmailDetailSheet.tsx` - add reminder button
- `src/components/emails/EmailList.tsx` - reminder badge
- `src/components/emails/EmailFilterTabs.tsx` - drafts tab
- `src/pages/Emails.tsx` - drafts tab handling
