# Project Command Center Overhaul: PM Workflow Engine

## Problem Summary

The current Project Detail page has the right tabs but they feel disconnected -- they're static displays rather than a workflow tool. The email thread from the Applebees - Kings Plaza project reveals the real daily life of a PM: a constant back-and-forth of requesting missing information (ACP5, CC info, engineer DOB emails, structural calcs, gas pressure), tracking who needs to do what, and ensuring nothing falls through the cracks. Ordino should reduce or automate most of that friction.

## What the Email Thread Teaches Us

The thread reveals ~10 distinct action items the PM had to manually track across emails:

1. **Missing documents** -- ACP5 from landlord, structural calcs, sealed drawings with job numbers
2. **Missing contact info** -- Engineer's DOB NOW email not registered, CC info for DOB fees, PA permit renewal contact
3. **Technical questions** -- Gas line operating pressure, plan exam vs pro-cert filing type
4. **Sequencing dependencies** -- Landlord must e-sign before architect can submit; plans must be sealed with job numbers first
5. **Cross-agency coordination** -- Rangehood plans filed separately with FDNY by others

**AI can extract all of these as checklist items from emails automatically.** The PM shouldn't have to manually track "I'm still waiting on the ACP5" -- the system should surface that.

---

## Implementation Plan

### 1. Project Readiness Checklist (New Top-Level Component) - this also shows what we have received by way of the PIS

Add a **Readiness Panel** between the financial summary cards and the tabs. This is the PM's "what do I need to do" dashboard for the project.

- A collapsible card showing outstanding items grouped by category:
  - **Missing Documents**: ACP5, sealed drawings, asbestos report
  - **Missing Info**: Engineer DOB email, CC info, gas pressure
  - **Pending Signatures**: Landlord e-sign, architect e-sign
  - **Pending Responses**: Awaiting client PIS, awaiting structural calcs
- Each item shows: what's needed, who it's from, when it was requested, days waiting
- Items can be manually added or **AI-extracted from tagged emails**
- Completing an item auto-logs to Timeline
- Mock data will demonstrate realistic items from the email thread

### 2. Emails Tab -- Full Functionality

Replace the static mock `EmailsFull` component with the real `ProjectEmailsTab` component that already exists, plus add a **Compose** button.

- Wire up the existing `ProjectEmailsTab` component (uses `useProjectEmails` hook with real data)
- Add a "Compose" button that opens `ComposeEmailDialog` with the project context pre-filled
- Emails sent from within the project are auto-tagged to that project
- Category filter (Objection, Agency, Client, Submission) already built into `ProjectEmailsTab`
- Clicking an email opens `EmailDetailSheet` (already built)

### 3. Documents Tab -- Mirror Universal Documents

Replace the static mock `DocumentsFull` with a layout matching the Universal Documents page:

- Search bar + category filter
- Upload dialog with title, category, description
- Table view with file icon, title, category badge, size, uploader, date
- Download and delete actions
- For now, use mock data styled to match the Universal Documents pattern; wire to real storage later

### 4. Services Tab -- Workflow Enhancements

Enhance the existing services section:

- **Per-service checklist** (not just tasks): A "Requirements" section showing what's needed before the service can proceed (plans uploaded, contacts confirmed, fees paid)
- **Status workflow**: When "Start DOB NOW" is clicked, show a preparation wizard/checklist rather than just a toast -- display what data Ordino already has pre-filled and what's missing
- **AI-extracted action items**: Items from emails tagged to this project get surfaced as tasks under the relevant service
- **Inline email**: Quick "Email about this" button per service that opens compose with subject pre-filled

### 5. Time Logs Tab -- Service-Level Summary

Add a summary section above the log table:

- **Time by Service** bar chart or simple table showing: Service Name | Allotted Hours | Logged Hours | Remaining | % Used
- Progress bars per service showing utilization
- The detailed log table stays below as-is

### 6. Change Orders Tab -- Collapsible Rows + Create Button

Enhance the change orders section:

- **Large "Create Change Order" button** at the top (like the legacy system)
- Change from card layout to a **collapsible table** where each row expands to show full details, linked services, and approval history
- When a service is "Dropped", prompt to create a CO automatically
- CO approval updates the financial summary cards in real-time

### 7. Contacts Tab -- PIS Integration Indicator

Enhance the contacts section:

- Add a **source indicator**: "From Proposal", "From PIS", "Manual"
- Show a **PIS status bar**: "PIS sent on Feb 5 -- 3 of 7 fields completed -- Follow up?" 
- Missing DOB role mapping highlighted in amber
- Quick "Send PIS Reminder" button if PIS is incomplete
- Contact cards show DOB NOW registration status (registered / not registered / unknown)

### 8. Job Costing -- Keep or Move

Add a subtle link/toggle: "Move to Reports" vs keeping it inline. For now, keep it on the page but make it the last tab since PMs use it less frequently. The financial summary cards at the top already give the quick margin view.

---

## Technical Details

### Files to Create

- None new -- all changes are to existing files

### Files to Modify

1. `**src/pages/ProjectDetail.tsx**` -- Major refactor:
  - Add Readiness Checklist component between financial cards and tabs
  - Replace `EmailsFull` mock with real `ProjectEmailsTab` + Compose button
  - Replace `DocumentsFull` mock with Universal Documents-style layout
  - Enhance `ServicesFull` with per-service requirements checklist
  - Enhance `TimeLogsFull` with service-level summary section
  - Enhance `ChangeOrdersFull` with collapsible table + create button
  - Enhance `ContactsFull` with PIS status and source indicators
2. `**src/components/projects/projectMockData.ts**` -- Add new mock data:
  - `MockChecklistItem` interface and sample items (from email thread)
  - `MockPISStatus` interface
  - Service-level hour allocations
  - Richer change order data with linked services

### Component Architecture

All components remain inline in `ProjectDetail.tsx` for now (matching current pattern), but are well-separated as named functions. The page structure becomes:

```text
ProjectDetail
  +-- Header (project name, status, PM, address)
  +-- Financial Summary Cards (contract, COs, total, billed, cost, margin)
  +-- Readiness Checklist (collapsible, grouped by category)
  +-- Tabs Card
       +-- Services (expandable rows + requirements + "Start DOB NOW" wizard)
       +-- Emails (real ProjectEmailsTab + Compose button)
       +-- Contacts (cards + PIS status + DOB registration)
       +-- Timeline (as-is, roadmapped for AI auto-population)
       +-- Docs (Universal Documents style)
       +-- Time (service summary + log table)
       +-- COs (collapsible table + big Create button)
       +-- Job Costing (as-is, last tab)
```

### Data Flow (Current Phase -- Mock)

All data remains mock for this implementation pass. The interfaces are designed to match the eventual database schema so the transition to real data will be straightforward. The Emails tab is the exception -- it will use the real `ProjectEmailsTab` component with live data from the `email_project_tags` table.