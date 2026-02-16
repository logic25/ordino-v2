

# PM New Project Assignment Workflow

## Overview

This plan redesigns the end-to-end workflow from the moment a proposal is signed through project kickoff, combining automated client outreach, PM review, smart follow-ups, and data collection for long-term business intelligence.

## The Workflow (End-to-End)

```text
 PROPOSAL SIGNED
       |
       v
 +------------------------------+
 | 1. Project auto-created       |
 |    - Services seeded          |
 |    - DOB app placeholder made |
 +------------------------------+
       |
       v
 +------------------------------+
 | 2. PM gets notification       |
 |    "You have a new project"   |
 |    - In-app alert + email     |
 |    - Link to project detail   |
 +------------------------------+
       |
       v
 +------------------------------+
 | 3. Client gets welcome email  |
 |    - Auto-sent at conversion  |
 |    - "Hi, your PM is [Name]"  |
 |    - Basic PIS link attached  |
 |      (pre-populated w/ known  |
 |       property + proposal     |
 |       data)                   |
 +------------------------------+
       |
       v
 +------------------------------+
 | 4. PM reviews project         |
 |    - Sees Readiness Checklist |
 |    - Sees what client filled  |
 |    - Identifies gaps          |
 +------------------------------+
       |
       v
 +------------------------------+
 | 5. PM sends targeted follow-  |
 |    up PIS (from template)     |
 |    - Picks template by type   |
 |    - Adds custom questions    |
 |    - System tracks "requested |
 |      on [date]"               |
 +------------------------------+
       |
       v
 +------------------------------+
 | 6. Auto follow-up engine      |
 |    - AI nudges client after   |
 |      X days if items missing  |
 |    - Escalates to PM after    |
 |      2-3 auto nudges          |
 |    - PM can also manually     |
 |      follow up                |
 +------------------------------+
       |
       v
 +------------------------------+
 | 7. Project Readiness = 100%   |
 |    "Ready to File" banner     |
 +------------------------------+
```

## What Gets Built

### Part A: Database Changes

**New columns on `projects` table:**
- `expected_construction_start` (date) -- client provides
- `estimated_construction_completion` (date) -- client provides
- `actual_construction_start` (date) -- tracked by PM
- `actual_construction_completion` (date) -- tracked by PM
- `project_complexity_tier` (varchar) -- Tier 1-4 classification
- `gc_company_name` (text) -- General Contractor company
- `gc_contact_name` (text) -- GC contact person
- `gc_phone` (text)
- `gc_email` (text)
- `architect_company_name` (text) -- Architect/Engineer firm
- `architect_contact_name` (text)
- `architect_phone` (text)
- `architect_email` (text)

**New `notifications` table:**
- `id`, `company_id`, `user_id` (recipient), `type` (enum: project_assigned, pis_reminder, readiness_update, etc.)
- `title`, `body`, `link` (URL to navigate to)
- `project_id` (nullable FK)
- `read_at` (nullable timestamp), `dismissed_at`
- `created_at`

**New `pis_tracking` table (tracks individual field requests):**
- `id`, `company_id`, `project_id`, `rfi_request_id`
- `field_id` (matches RFI field IDs)
- `field_label`
- `first_requested_at`
- `last_reminded_at`
- `reminder_count` (int)
- `fulfilled_at` (nullable -- set when data entered)
- `fulfilled_by` (enum: client, pm)

### Part B: Proposal Conversion Enhancement

When `useSignProposalInternal` runs (proposal signed):
1. Create project (existing)
2. Create notification for assigned PM: "New project assigned: [name] at [address]"
3. Auto-generate a "welcome" PIS/RFI with basic fields pre-populated from proposal + property data
4. Record tracking entries in `pis_tracking` for each required field
5. Store the welcome PIS link on the project for reference

### Part C: PM Notification System

- Notification bell icon in TopBar with unread count badge
- Dropdown panel showing recent notifications
- Click navigates to project detail
- Mark as read / dismiss actions
- Types: `project_assigned`, `pis_submitted`, `pis_overdue`, `readiness_complete`

### Part D: Project Detail Enhancements

**New fields in project header/edit dialog:**
- Construction timeline (expected start, estimated completion)
- GC info (company, contact, phone, email)
- Architect info (company, contact, phone, email)
- Complexity tier selector (Tier 1-4 with descriptions)

**Enhanced Readiness Checklist:**
- Each item shows "Requested on [date]" if tracked
- Items auto-check when corresponding PIS data is submitted
- "Send Follow-up" button per missing item or bulk
- Visual: overdue items (>5 days) highlighted amber, >14 days red

### Part E: PIS Templates by Project Type

- Settings page for managing PIS templates (already exists: `rfi_templates` table)
- Pre-seed 3-4 templates:
  - **Standard Alteration** (most common)
  - **New Building / Gut Renovation** (more detail needed)
  - **Legalization** (existing conditions focus)
  - **Mechanical Only** (simpler scope)
- PM can pick template when sending targeted follow-up
- Template picker UI on project detail: "Send PIS" dropdown with template options

### Part F: Auto Follow-up Engine

- Edge function `process-pis-reminders` (runs on schedule or manual trigger)
- Logic: query `pis_tracking` where `fulfilled_at IS NULL` and `last_reminded_at < now() - interval`
- Generates notification for PM: "[Project] still missing [X items] -- requested [Y days ago]"
- Future: AI-generated email to client (requires approval)
- Configurable in Signal Settings: reminder frequency, max auto-reminders before escalation

### Part G: Contractor/Architect Performance Tracking (Data Collection Phase)

- Fields on project for GC and Architect (see Part A)
- Timeline comparison: estimated vs actual dates stored per project
- No analytics dashboard yet (Phase 2) -- just collect the data
- PIS form updated to include GC/Architect sections (already exists in current PIS template, just needs to flow back into project fields)

## Implementation Order

| Step | What | Effort |
|------|------|--------|
| 1 | DB migration: new project columns + notifications + pis_tracking tables | Medium |
| 2 | Notification system (bell icon, dropdown, mark read) | Medium |
| 3 | Proposal conversion: auto-notify PM + auto-send welcome PIS | Medium |
| 4 | Project detail: timeline fields, GC/Architect fields, complexity tier | Small |
| 5 | Enhanced Readiness Checklist with tracking dates | Medium |
| 6 | PIS template picker on project detail | Small |
| 7 | Auto follow-up edge function | Medium |
| 8 | Seed 3-4 PIS templates by project type | Small |

Total: ~6 implementation steps across 3-4 sessions.

## What This Achieves

- **Speed**: Client gets PIS link immediately at conversion, no PM bottleneck
- **Precision**: PM sends targeted follow-up after review, not duplicating what client already provided
- **Accountability**: Every missing item has a timestamp -- "requested 12 days ago, reminded twice"
- **Intelligence**: Construction timelines + contractor data collected from day 1 for future analytics
- **Automation**: System nudges before PM has to think about it

