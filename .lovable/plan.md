

## Bug Tracker Workflow & Comments Enhancement

### The Problem
Right now the bug detail sheet only has "Admin Notes" (a single text field) and an activity log that tracks changes. There's no way to have a back-and-forth conversation about a bug — you can't respond to the reporter or ask for clarification, and the reporter (like Chris) can't explain why they reopened it.

### Proposed Workflow

**Statuses: Open → In Progress → Resolved**
- **Open** — New bug, not yet being worked on
- **In Progress** — You're actively working on it (email notification sent to admins/managers)
- **Resolved** — Fix is deployed (email notification sent to reporter + admins)

When Chris (the reporter) reopens a bug, the status goes back to **Open** and admins are notified.

### What Will Be Built

**1. Bug Comments Thread**
- New `bug_comments` database table (`id`, `bug_id`, `company_id`, `user_id`, `message`, `created_at`)
- RLS: company-scoped read/write for authenticated users
- Replaces the single "Admin Notes" textarea with a threaded comment feed
- Any team member (admin or reporter) can post comments
- Comments show user name, timestamp, and message
- A compose input at the bottom of the detail sheet

**2. Keep Admin Notes as Internal-Only**
- Admin Notes stays as a separate private field (only visible to admins) for internal resolution summaries
- Comments are visible to everyone on the team

**3. Reporter Visibility**
- Non-admin users will now see the comment thread on their own bugs, so they can explain why they reopened or ask questions
- The reporter name is shown in the detail sheet header

**4. Notification on Comment**
- When an admin comments, the reporter gets an email notification (via existing `send-bug-alert` function with a new `action: "comment"`)
- When the reporter comments, admins get notified

### Technical Details

**Database migration:**
```sql
CREATE TABLE public.bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bug_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can read comments"
  ON public.bug_comments FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company members can insert comments"
  ON public.bug_comments FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
```

**UI changes in BugReports.tsx:**
- Add a comments query + mutation in the detail sheet
- Render comment thread between the description and admin section
- Add a text input + send button for new comments
- Activity log remains at the bottom

**Edge function update (`send-bug-alert`):**
- Add `action: "comment"` handler that emails the other party (reporter gets admin comments, admins get reporter comments)

