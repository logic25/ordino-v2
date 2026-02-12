

# Gmail Email Tagging System for Ordino - Phase 1 MVP

## Overview

Build the complete email management infrastructure -- database, UI, and backend functions -- so emails can be synced from Gmail, viewed in an inbox, tagged to projects, and browsed per-project. Gmail OAuth credentials will be wired in later; the system will be fully functional once connected.

## What Gets Built

### 1. Database Tables (Migration)

Four new tables, all with `company_id` and RLS:

- **gmail_connections** -- stores per-user OAuth tokens (encrypted refresh token, email address, sync status, last sync timestamp)
- **emails** -- cached email metadata (gmail_message_id, thread_id, subject, from/to, snippet, body, has_attachments, labels, synced_at)
- **email_project_tags** -- many-to-many link between emails and projects with category (objection / agency / client / submission / other), tagged_by, notes
- **email_attachments** -- attachment metadata per email (filename, mime_type, size, gmail_attachment_id, saved_to_project flag)

### 2. Edge Functions (Backend)

Three backend functions handling all Gmail API communication:

- **gmail-auth** -- handles OAuth2 callback, exchanges code for tokens, stores refresh token in gmail_connections
- **gmail-sync** -- fetches recent emails from Gmail API using stored tokens, upserts into emails table, extracts attachment metadata; supports manual trigger and incremental sync via history ID
- **gmail-attachments** -- downloads a specific attachment from Gmail API on demand, optionally saves to project storage bucket

### 3. New Pages and Components

**Email Inbox Page (`/emails`)**
- Sidebar nav entry: "Email" with Mail icon
- Top bar: Gmail connect/disconnect button, manual sync trigger, last sync timestamp
- Email list with sender, subject, date, snippet, attachment indicator, tag status
- Filters: untagged only, date range, by project
- Search bar across subject and snippet
- Click email to open detail panel

**Email Detail Panel (Sheet/Drawer)**
- Full email content (HTML rendered safely)
- Thread history (grouped by thread_id)
- Attachment list with download buttons
- "Tag to Project" dropdown with project search
- Category selector (Objection / Agency / Client / Submission / Other)
- Optional notes field
- Save button

**Project Email Tab**
- New "Emails" tab on project detail/dialog
- Chronological list of tagged emails for that project
- Filter by category and date
- Each card: subject, sender, date, snippet, category badge
- Quick actions: view full email, remove tag

### 4. Data Hooks

- `useGmailConnection()` -- check/create/disconnect Gmail connection status
- `useEmails()` -- list emails with filtering, search, pagination
- `useEmailDetail(id)` -- single email with attachments
- `useEmailTags()` -- create/delete project tags
- `useProjectEmails(projectId)` -- emails tagged to a specific project

### 5. Routing and Navigation

- Add `/emails` route (protected) in App.tsx
- Add "Email" nav item to AppSidebar between Invoices and Companies
- Create `src/pages/Emails.tsx` as the main inbox page

## Technical Details

### Database Schema (SQL)

```text
gmail_connections
  id              uuid PK
  company_id      uuid FK -> companies (RLS)
  user_id         uuid FK -> profiles
  email_address   varchar
  refresh_token   text (encrypted)
  access_token    text
  token_expires_at timestamptz
  last_sync_at    timestamptz
  history_id      varchar (Gmail incremental sync)
  sync_enabled    boolean default true
  created_at      timestamptz
  updated_at      timestamptz

emails
  id              uuid PK
  company_id      uuid FK -> companies (RLS)
  user_id         uuid FK -> profiles (who synced it)
  gmail_message_id varchar UNIQUE per company
  thread_id       varchar
  subject         text
  from_email      varchar
  from_name       varchar
  to_emails       jsonb
  date            timestamptz
  body_text       text
  body_html       text
  snippet         text
  has_attachments boolean default false
  labels          jsonb
  is_read         boolean default true
  synced_at       timestamptz
  created_at      timestamptz

email_project_tags
  id              uuid PK
  email_id        uuid FK -> emails
  project_id      uuid FK -> projects
  company_id      uuid FK -> companies (RLS)
  tagged_by_id    uuid FK -> profiles
  category        varchar (objection/agency/client/submission/other)
  notes           text
  tagged_at       timestamptz default now()

email_attachments
  id              uuid PK
  email_id        uuid FK -> emails
  company_id      uuid FK -> companies (RLS)
  filename        varchar
  mime_type       varchar
  size_bytes      integer
  gmail_attachment_id varchar
  saved_to_project boolean default false
  storage_path    text
  created_at      timestamptz
```

### RLS Policies

All four tables use the existing `is_company_member(company_id)` for SELECT and `is_admin_or_manager(company_id)` for INSERT/UPDATE/DELETE, consistent with the rest of the app. gmail_connections additionally restricts SELECT/UPDATE to own records via user_id match.

### Edge Function Architecture

```text
  Browser                    Edge Function              Gmail API
    |                            |                          |
    |-- POST /gmail-auth ------->|                          |
    |   (auth code)              |-- exchange code -------->|
    |                            |<-- tokens ---------------|
    |                            |-- store in DB            |
    |<-- success ----------------|                          |
    |                            |                          |
    |-- POST /gmail-sync ------->|                          |
    |                            |-- list messages -------->|
    |                            |<-- message list ---------|
    |                            |-- get each message ----->|
    |                            |<-- full message ---------|
    |                            |-- upsert to emails table |
    |<-- sync complete ----------|                          |
```

### File Structure

```text
src/pages/Emails.tsx                          -- inbox page
src/components/emails/EmailList.tsx           -- email list with filters
src/components/emails/EmailDetailSheet.tsx    -- email detail drawer
src/components/emails/EmailTagDialog.tsx      -- tag-to-project dialog
src/components/emails/ProjectEmailsTab.tsx    -- emails tab for projects
src/components/emails/GmailConnectButton.tsx  -- connect/disconnect Gmail
src/hooks/useEmails.ts                        -- all email data hooks
src/hooks/useGmailConnection.ts               -- Gmail connection management
supabase/functions/gmail-auth/index.ts        -- OAuth handler
supabase/functions/gmail-sync/index.ts        -- email sync
supabase/functions/gmail-attachments/index.ts -- attachment download
```

### Gmail Credentials

The edge functions will read `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` from secrets. These won't be configured yet (per your choice to skip Gmail setup for now). The UI will show a "Connect Gmail" button that gracefully indicates setup is needed. Once you're ready, I'll walk you through creating a Google Cloud project and adding the credentials.

## Implementation Order

1. Database migration (all 4 tables + RLS + indexes)
2. Edge functions (gmail-auth, gmail-sync, gmail-attachments)
3. Data hooks (useGmailConnection, useEmails, useEmailTags, useProjectEmails)
4. Email inbox page with list, filters, search
5. Email detail sheet with tagging UI
6. Project emails tab
7. Navigation and routing updates

