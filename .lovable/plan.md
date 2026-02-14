# Time Tracking -- Legacy-Style Clock In/Out + Project Attribution

## Overview

Replicate the legacy Ordino pattern: **auto clock-in on login, 5 PM reminder to clock out, simple attendance log showing who, when, and from where** -- then layer on the new value: **what project, what service, how long**.

1. **Business Rules & Edge Cases**
  ### **Employment Types**
  - **Current**: All exempt (salaried) employees — no overtime tracking needed
  - **Future**: Part-time hourly workers may be added → system should support this but doesn't enforce punch-in/out strictness yet
  - **Implication**: Attendance logs are primarily for **accountability & project attribution**, not legal timekeeping (for now)
  ### **Permissions & Roles**
  - **Admin-only** for all sensitive operations:
    - Edit/delete anyone's attendance logs
    - View IP addresses & location data
    - Adjust billable rates & service types
  - **Regular users** can:
    - View their own attendance history
    - Log/edit their own time entries
    - Clock out manually anytime
  - **Managers** (if role exists): Same as regular users for MVP — admin handles corrections
  ### **Billable vs Non-Billable** *(deferred enforcement)*
  - Services table has a `billable` boolean, but **no hard validation** on time entries yet
  - Users can mark individual time entries as billable/non-billable when logging
  - **Future consideration**: Some services (e.g., "Plan Examination") should inherit billable=true by default, others (e.g., "Internal Meeting") should default to false
  - For now: **user's choice at time-entry creation**
  ### **Partial Day Attribution (Gap Detection)**
  - **Primary goal**: Surface unaccounted-for time so users can see what's not attributed to projects
  - **How it works**:
    - Attendance log shows total clocked time (e.g., 8.5 hours)
    - Time entries (project breakdowns) sum to attributed time (e.g., 6 hours)
    - **Gap = 2.5 hours** → display this prominently in the Time page
    - Show a warning badge: "2.5h unattributed" with a "Log Time" quick-action
  - **No blocking**: Users can clock out with gaps — this is a visibility feature, not enforcement
  - **Admin view**: Managers/admins can see team-wide gaps in a summary report (future)
  ### **Forgot to Clock Out?**
  - **Auto-close at midnight**: If an attendance log is still open (no `clock_out`) at 11:59 PM, system auto-sets `clock_out = 11:59 PM` and flags the record with `auto_closed: true`
  - **Next day**: User sees a notification: "Yesterday's log was auto-closed at midnight — please verify your hours"
  - **Manual correction**: User (or admin) can edit the clock-out time retroactively
  ### **Multiple Logins Per Day**
  - **MVP behavior**: Only **one attendance log per user per day**
  - If user logs out at lunch and logs back in at 2 PM, the existing attendance log remains open (doesn't create a second entry)
  - **Implication**: `clock_in` reflects first login of the day, `clock_out` reflects final logout
  - **Future**: If you need to track lunch breaks separately, add `break_minutes` column or create pause/resume logic
  ### **5 PM Reminder Modal Behavior**
  - **Trigger**: Modal appears at 5:00 PM **only if**:
    - User has an open attendance log for today
    - User hasn't dismissed the modal today already
  - **Dismiss action**: Closes modal, sets a `dismissed_at` timestamp in localStorage → won't re-appear today
  - **Snooze option**: "Remind me in 30 min" button → re-triggers modal at 5:30 PM (max 2 snoozes)
  - **If ignored**: Modal stays in background (non-blocking) but shows a persistent "You're still clocked in" badge in the header
  ### **Manual Clock-Out Flow**
  - **From Time page**: User clicks "Clock Out" button → same modal as 5 PM reminder (shows total hours, prompts for project attribution)
  - **Attribution is optional**: User can skip project breakdown and just clock out (creates gap, but allowed)
  - **If already attributed time earlier**: Modal pre-fills with existing entries, shows remaining unattributed hours
  ### **Mobile Responsiveness**
  - **All components must work on mobile** (most staff is remote, but DOB visits = phone use)
  - Clock-in/out buttons: Large touch targets
  - Time entry dialog: Single-column layout on mobile
  - Attendance table: Horizontal scroll or card-based layout on small screens
  - 5 PM modal: Full-screen on mobile (not a small dialog)
  ### **Weekend/Holiday Handling**
  - **No special logic for MVP**: System allows clock-in any day
  - Users working weekends can clock in normally
  - **Future**: Add company calendar integration to mark non-work days, skip auto-clock-in on those days
  ### **Data Validation**
  - **Max hours warning**: If total clocked time > 14 hours, show a warning: "This seems high — verify your clock-out time"
  - **Overlapping entries**: When creating time entries, check if duration would overlap with other entries for the same day (warn, but don't block)
  - **Service/project mismatch**: Validate that selected service is linked to selected project via `service_availability` table (block if invalid)
  ---
  ## **Reporting Hooks (Deferred but Planned)**
  Even though export/reporting is Phase 2, define the **data points** now so hooks are in place:
  ### **Weekly Summary Email** *(future)*
  - Sent Monday 9 AM: "Last week: 42 hours clocked, 35 billable, 7 unattributed"
  - Links to Time page to fill gaps
  ### **Manager Dashboard** *(future)*
  - Real-time: Who's clocked in right now, total hours this week per team member
  - Flags: Team members with >10% unattributed time
  ### **Export Format** *(future)*
  - CSV columns: `User, Date, Clock In, Clock Out, Total Hours, Project, Service, Duration, Billable, Notes`
  - Filters: Date range, team member, project, billable status
  - Access: Admin-only
  ### **Mobile App Considerations** *(way future)*
  - If you build a native app, use the same `attendance_logs` + `activities` tables
  - Push notification for 5 PM reminder instead of modal
  - GPS-based location capture (more accurate than IP geolocation)
2. **Mount ClockOutModal globally**: In AppLayout

## What This Does NOT Build Yet

- **Services management UI**: The `services` table exists but there's no dedicated UI to manage the service catalog per project. Users will select from existing services linked to their projects. The service catalog in Settings already partially covers this.
- **Timesheet grid view**: Weekly grid (rows=projects, cols=days) is deferred -- the attendance log + time entry dialog covers the core need first.
- **Export/reporting**: Deferred to a later phase.