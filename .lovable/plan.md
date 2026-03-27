

## Bug Workflow Cleanup

Remove the **Assign To** dropdown and **Internal Notes** textarea from the bug management panel, keeping the core workflow (Status + required comment + Save/Delete) intact.

### Changes in `src/components/helpdesk/BugReports.tsx`

**1. Remove state variables** (lines 89, 91)
- Delete `editAssignee` state
- Delete `editNotes` state

**2. Remove state initialization in `openDetail`** (lines 357, 359)
- Remove `setEditNotes(bug.admin_notes || "")`
- Remove `setEditAssignee(bug.assigned_to || "")`

**3. Clean up `saveDetail` function** (lines 379-407)
- Remove `admin_notes` and `assigned_to` from the `updates` object
- Remove the assignment change activity log block (lines 399-403)
- Remove the notes updated activity log block (lines 405-406)

**4. Remove from email notification payloads** (lines 480, 518)
- Remove `admin_notes: editNotes` from send-bug-alert calls

**5. Remove from "Copy for Lovable"** (line 541)
- Remove the `if (editNotes)` admin notes line

**6. Remove UI elements** (lines 1095-1112)
- Delete the entire "Assign To" `<Select>` block
- Delete the entire "Resolution Notes" `<Textarea>` block

Everything else stays: status dropdown, required comment on transitions, reporter review buttons, activity log, email notifications.

