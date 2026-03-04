
-- Track which reminders have already been sent per project
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS completion_reminder_2w_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_reminder_due_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_reminder_overdue_sent boolean NOT NULL DEFAULT false;
