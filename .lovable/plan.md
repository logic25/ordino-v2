

## Analysis of Edit Project Dialog

You raise great points. Here's a breakdown of each concern and a proposed redesign:

### 1. Tooltips — Not needed
The dialog fields are self-explanatory. Adding tooltips would add visual clutter without value. No action here.

### 2. Client, Building Owner, GC, Architect — Remove from Edit Project
These fields are redundant in the Edit Project dialog because:
- **Client & Building Owner** are already set at the **Proposal** level and flow into the project automatically. They should be displayed read-only on the project detail page (already shown in the Quick Reference Bar and PIS), not editable here.
- **GC & Architect** are captured through the **PIS (Project Information Sheet)** and the **RFI form**, which is the correct workflow — those details come from the client intake process, not from internal project editing.

**Plan:** Remove the Client, Building Owner, General Contractor, and Architect/Engineer sections from the Edit Project dialog entirely. These are managed through proposals and PIS.

### 3. Complexity Tier — Auto-assign, not manually selected
Nobody will manually pick a complexity tier. Instead:
- **Auto-calculate** the tier based on project data that already exists: project type, square footage (from PIS), and service mix.
- Display it as a **read-only badge** on the project detail page header, next to the status.
- Remove the dropdown from the Edit Project dialog.

### 4. Construction Timeline — Simplify to "Expected Completion"
Four date fields (Expected Start, Estimated Completion, Actual Start, Actual Completion) are overkill. Most jobs don't track all four.

**Plan:**
- Replace the entire Construction Timeline section with a single **"Expected Completion Date"** field in the Edit Project dialog.
- When set, the system logs a timeline event and can surface follow-up reminders as the date approaches (e.g., 2 weeks before, on the date, 1 week overdue).
- For small jobs (research, DOB visits), the field stays blank — no pressure to fill it.

---

### Summary of changes

**Edit Project dialog (ProjectDialog.tsx):**
- Remove: Client selector, Building Owner selector, GC section (4 fields), Architect section (4 fields), Complexity Tier dropdown, Construction Timeline (4 date fields)
- Keep: Property, Project Name, Project Type, Status, Floor Number, Unit/Apt, Tenant Name, Client Reference #, PM, Senior PM, Notable toggle, Notes
- Add: Single "Expected Completion Date" field (replaces 4 timeline fields)

**ProjectDetail.tsx:**
- Show complexity tier as an auto-calculated read-only badge (future iteration — can be deferred)

**useProjects.ts (ProjectFormInput type):**
- Remove the corresponding fields from the form input type to keep it clean

This dramatically simplifies the dialog from ~25 fields to ~12, focusing on what someone actually fills in when creating or editing a project.

