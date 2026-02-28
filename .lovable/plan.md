

# Project Detail Page Improvements

## Issues to Fix

### 1. "Send to Billing" should open the full billing dialog with confirmation
**Current behavior:** The "Send to Billing" button on the services table just instantly marks services as "billed" with a toast -- no confirmation, no partial billing options.
**Fix:** Wire the button to open the existing `SendToBillingDialog` (which already supports % and $ amount partial billing). The dialog already has confirmation built in. After successful submission, refresh the services list so billed services reflect their new status.

### 2. Billed services should be hidden (or visually separated) from the active services list
**Current behavior:** Billed services stay in the list with a "Billed" badge but still clutter the view.
**Fix:** Filter out services with status "billed" from the main table, or collapse them into a "Billed Services" section at the bottom that's collapsed by default. This keeps the active service list clean.

### 3. "Add Task" in service detail vs "Tasks" tab -- clarify these are the same
**Current behavior:** Each expanded service has an "+ Add Task" button for service-level tasks (local state only). The "Tasks" tab at the top is the Action Items tab (database-backed). These are actually different things.
**Fix:** Rename the service-level tasks section to "Service Notes / Checklist" or keep "Tasks" but add a label clarifying it's specific to that service. The "Tasks" tab in the main nav stays as the project-wide action items. No functional change needed -- they serve different purposes, but the labeling can be clearer.

### 4. "Email about this" button -- what it does
**Current behavior:** The "Email about this" button next to the service-level "Add Task" button currently does nothing (no onClick handler).
**Fix:** Wire it to open the Compose Email dialog pre-filled with the service name in the subject line and the project context, making it easy to email a team member or client about a specific service.

### 5. Horizontal scrolling on the page -- must be eliminated
**Current behavior:** The services table has 12 columns (checkbox, expand, drag, Service, Status, Assigned, Disciplines, Est. Bill Date, Price, Cost, Margin, Action) causing horizontal overflow.
**Fix:** Wrap the services table in `overflow-x-auto` on the table container and ensure the outer page container has `overflow-x-hidden`. Also add `min-w-0` to flex containers to prevent content from pushing the page wider.

---

## Technical Details

### File: `src/pages/ProjectDetail.tsx`

**Send to Billing with dialog:**
- Import `SendToBillingDialog` from the invoices folder.
- Add state `sendToBillingOpen` to the `ServicesFull` component.
- Change `handleSendToBilling` to open the dialog instead of instantly marking as billed.
- Pass `preselectedProjectId` to the dialog so it auto-fills.

**Hide billed services:**
- In the `ServicesFull` component, split `orderedServices` into active (non-billed) and billed groups.
- Show only active services in the main table.
- Add a collapsible "Billed Services" section below showing completed ones.

**Horizontal scroll fix:**
- Add `overflow-x-auto` wrapper around the services `<Table>`.
- Add `overflow-x-hidden` to the outermost project detail container.
- Add `min-w-0` to key flex containers.

**"Email about this" button:**
- Wire the onClick to open the ComposeEmailDialog with the service name as subject context.

**Task label clarification:**
- Rename the service-level "Tasks" heading to "To-Dos" to distinguish from the main "Tasks" (Action Items) tab.

