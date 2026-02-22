

# Action Items System -- Full Implementation Plan

## What We're Building

A project-level task system where action items are created in Ordino, posted as threaded cards to Google Chat, and completed by replying directly in GChat with a photo and/or note. Google Chat's built-in threading maps each reply to the correct action item automatically.

---

## Phase 1: Database Foundation

### Step 1 -- Create Tables, Triggers, and Storage

**Table: `project_action_items`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | RLS scoping |
| project_id | uuid FK | FK to projects |
| title | text | Required |
| description | text | Optional details |
| assigned_to | uuid FK | FK to profiles |
| assigned_by | uuid FK | FK to profiles |
| status | text | `open` / `done` / `cancelled`, default `open` |
| priority | text | `normal` / `urgent`, default `normal` |
| due_date | date | Optional |
| attachment_ids | jsonb | Array of document references |
| completion_note | text | Note when marking done |
| completion_attachments | jsonb | Array of `{ name, storage_path }` |
| completed_at | timestamptz | Auto-set on done |
| gchat_thread_id | text | For GChat reply matching |
| gchat_space_id | text | GChat Space reference |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated trigger |

**Table: `project_timeline_events`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| project_id | uuid FK | |
| event_type | text | `action_item_created`, `action_item_completed`, etc. |
| description | text | Human-readable |
| actor_id | uuid FK | FK to profiles |
| metadata | jsonb | Action item ID, attachments, etc. |
| created_at | timestamptz | |

**Triggers:**
- `updated_at` trigger on `project_action_items`
- Auto-set `completed_at = now()` when status changes to `done`
- Auto-insert timeline event on action item creation
- Auto-insert timeline event on action item completion

**RLS:** Company members can CRUD their company's action items and read timeline events.

**Realtime:** Enable on both tables.

**Storage bucket:** `action-item-attachments` (private) for completion photos/files.

---

## Phase 2: In-App Hook and Components

### Step 2 -- `useActionItems` Hook

Following the existing hook pattern (like `useUniversalDocuments`, `useNotifications`):

- `useActionItems(projectId)` -- list all action items for a project with assignee profile joins
- `useMyActionItems()` -- open items assigned to current user across all projects (for dashboard)
- `useCreateActionItem()` -- mutation to create with optional document attachments
- `useCompleteActionItem()` -- mutation to mark done with optional note + photo upload to storage
- `useCancelActionItem()` -- mutation to cancel

### Step 3 -- "Action Items" Tab in Project Detail

Add a new tab to `ProjectExpandedTabs.tsx` (after COs, before Job Costing):

- Tab label: "Action Items" with count badge
- List view showing: assignee avatar/name, title, status badge (open/done/cancelled), priority indicator, due date, attachment count
- Urgent items highlighted
- Filter toggles: All / Open / Done

### Step 4 -- New Action Item Dialog

- Title (required)
- Description (optional textarea)
- Assign to: dropdown of company team members (reusing `useCompanyProfiles`)
- Priority: normal / urgent toggle
- Due date: optional date picker
- Attach from project: picker showing documents from the project's Documents tab
- Upload new file: standard file upload

### Step 5 -- Complete Action Item Dialog

When clicking "Mark Done" on an open item:

- Optional note textarea ("What did you do?")
- Optional photo/file upload (camera icon, supports mobile camera)
- Confirm button
- Uploads files to `action-item-attachments` bucket, stores references in `completion_attachments`

### Step 6 -- Action Item Detail View

Clicking an action item row expands or opens a sheet showing:

- Full description
- Attached project documents (with download links)
- Completion note and photos (if done)
- Timeline: created, completed timestamps
- Actions: Mark Done, Cancel

### Step 7 -- "My Action Items" Dashboard Card

Add to `PMDailyView.tsx`:

- Card titled "My Action Items" with badge count of open items
- List sorted by due date, urgent items first
- Each row: project number + name, title, who assigned it, due date
- Click navigates to the project detail page

### Step 8 -- Notification on Assignment

When an action item is created, insert a notification for the assignee using the existing `notifications` table pattern:

- Type: `action_item_assigned`
- Message: "[Assigner] assigned you: [title]"
- Link to project detail

---

## Phase 3: Timeline Tab (Real Data)

### Step 9 -- Wire Timeline Tab to Real Data

Replace the mock timeline data in `ProjectExpandedTabs.tsx` with real data from `project_timeline_events`:

- Query events for the project, ordered by date descending
- Show event type icon, description, actor name, timestamp
- Action item events link to the action item detail

---

## Phase 4: Google Chat Integration

### Step 10 -- Google Chat Settings in Company Settings

Add a "Google Chat" card to Company Settings:

- GChat Space ID field
- Enable/disable toggle for GChat notifications
- Setup instructions for one-time Google Cloud configuration (Chat API, service account, internal deployment)

### Step 11 -- Backend Function: `send-gchat-action-item`

Edge function triggered when a new action item is created:

1. Read action item details + attachments
2. Build a Card V2 message (title, project info, description, document links, due date, "Mark Done" button, "Open in Ordino" link)
3. Post to configured GChat Space (creates new thread)
4. Store returned `thread.name` as `gchat_thread_id` on the action item

Requires secret: `GOOGLE_CHAT_SERVICE_ACCOUNT_KEY`

### Step 12 -- Backend Function: `gchat-interaction`

HTTP endpoint receiving GChat interaction events:

**Button click ("Mark Done"):**
- Identify action item from card metadata
- Update status to done
- Update GChat card to show completion
- Insert timeline event + notification

**Thread reply (text + photo):**
- Match `thread.name` to `gchat_thread_id`
- If image attached: download from GChat API, upload to storage bucket, add to `completion_attachments`
- If message contains "done": mark action item done, store reply text as `completion_note`
- Update GChat card to show completion status

---

## Implementation Sequence

| Step | Description | Depends On |
|------|-------------|------------|
| 1 | Database tables, triggers, RLS, storage bucket | -- |
| 2 | `useActionItems` hooks | Step 1 |
| 3 | Action Items tab in Project Detail | Steps 1-2 |
| 4 | New Action Item dialog | Steps 1-2 |
| 5 | Complete Action Item dialog (with photo upload) | Steps 1-2 |
| 6 | Action Item detail view | Steps 3-5 |
| 7 | "My Action Items" dashboard card | Step 2 |
| 8 | Assignment notification | Step 2 |
| 9 | Timeline tab with real data | Step 1 |
| 10 | GChat settings in Company Settings | -- |
| 11 | `send-gchat-action-item` edge function | Steps 1, 10 |
| 12 | `gchat-interaction` edge function | Step 11 |

Steps 1-9 deliver a fully functional in-app system. Steps 10-12 layer on Google Chat. Both completion paths update the same data -- mark done in Ordino or in GChat, either way the project gets updated.

---

## Technical Notes

- All new tables use `company_id` for multi-tenant RLS, following the existing security pattern with `is_company_member()`.
- Hooks follow the existing `useQuery` / `useMutation` patterns with `@tanstack/react-query`.
- The Google Chat integration uses a service account (not OAuth) so it works server-side without user login.
- The existing RAG bot in Google Chat is unaffected -- each bot has its own identity and event routing. Ordino's bot only responds to its own cards and threads.

