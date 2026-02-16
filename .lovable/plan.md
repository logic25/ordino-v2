# Ordino Feature Roadmap

## Status Legend
- 🔴 Not Started | 🟡 In Progress | 🟢 Done

---

## ✅ COMPLETED

### Signal Integration (PropertyGuard)
- 🟢 Database tables: `signal_subscriptions`, `signal_violations`, `signal_applications`
- 🟢 Hooks: `useSignalSubscriptions`, `useSignalViolations`, `useSignalApplications`
- 🟢 UI: Signal column, filter tabs, expanded row section, enrollment dialog

---

## PHASE 1: Bug Fixes & Missing Functionality

### 1A. 🟢 Edit Project — Add "Building Owner" Field
- Added `building_owner_id` (FK → clients) and `building_owner_name` (text) to `projects`
- Dropdown + free-text in project dialog, displayed on project detail header
- Display on project detail header next to Client
- **Effort:** Small

### 1B. 🟢 Project Contacts — Show Primary Contact
- Primary contact fetched from client_contacts (is_primary flag)
- Shown in project detail header with name + phone
- Falls back to mock contact if no DB primary contact found
- **Effort:** Small

### 1C. 🟢 Lead Statuses — Seed Defaults
- Expanded to 9 statuses (New, Contacted, Qualified, Proposal Sent, Negotiating, Won, Lost, On Hold, Referral)
- Auto-seeds on first access if none exist
- Editable, reorderable, deletable
- **Effort:** Small

### 1D. 🔴 Filing Checklist — Editable Per Project
- New `project_checklist_items` table
- Toggle checkbox = instant save, custom items, notes + file attachment
- Completion % + "Ready to File" banner
- **Effort:** Medium

### 1E. 🔴 Team & Users — Add Team Member
- "+ Add Team Member" button, invite form, edit/deactivate
- Defer new roles to later phase (use existing Admin/Production/Accounting)
- **Effort:** Medium

### 1F. 🔴 Universal Documents — Fix Upload & Drag-and-Drop
- Remove duplicate button, add drag-and-drop zone
- Quick form: name, category, tags, linked project/property
- Multi-file upload
- **Effort:** Medium

### 1G. 🟢 Proposals — Retainer Carry-Through
- Added retainer_amount to proposals table
- Retainer field in proposal dialog (Terms tab), editable, defaults to $0
- Carries to project (retainer_amount + retainer_balance) on conversion
- **Effort:** Small

---

## PHASE 2: PM Dashboard — Role-Based Daily View

### 2A. 🔴 PM Daily Dashboard (HIGHEST PRIORITY)
- Personalized greeting: "Good morning, [Name]"
- **Section 1:** Today's Tasks — overdue (red), due today (amber), upcoming (blue)
- **Section 2:** My Active Projects — cards with status, next action, staleness
- **Section 3:** Reminders & AI Notifications
- **Section 4:** Recent Activity Feed
- Show for Production role users
- **Effort:** Large

### 2B. 🔴 Admin Dashboard Enhancements
- "Switch to My View" toggle for PM-style view
- Team activity summary, revenue snapshot
- **Effort:** Medium

### 2C. 🔴 Field Staff Dashboard
- Deferred — requires new role system
- **Effort:** Large (deferred)

---

## PHASE 3: Reminders & AI System

### 3A. 🔴 Manual Reminders
- New `reminders` table (title, description, due_date, repeat, project_id, assigned_to, status)
- "+ Reminder" button on projects, dashboard, calendar
- Dashboard + calendar integration
- Overdue persistence + visual escalation
- Snooze / Dismiss / Mark Done
- **Effort:** Medium

### 3B. 🔴 AI-Generated Reminders (Lovable AI / Gemini)
- Edge function analyzing project data for smart notifications
- Rules: stale projects, ready-to-file, overdue invoices, expiring COIs, DOB timing
- Notification bell badge + panel
- Configurable email digests
- **Effort:** Medium

### 3C. 🔴 Project Summary on Demand
- "Get Summary" button on project detail
- Structured summary: status, contacts, billing, checklist, alerts
- Printable one-pager
- **Effort:** Medium

---

## PHASE 4: PM Workflow — New Project Assignment

### 4A. 🔴 Project Assignment Notification
- Notification when PM assigned new project
- Links to project detail
- **Effort:** Small

### 4B. 🔴 Project Readiness Checklist
- Auto-generated from project data completeness
- Auto-check when data exists, "Fix" buttons
- Progress bar
- **Effort:** Medium

### 4C. 🔴 Project Timeline Setup
- Key milestone date fields (filing, DOB response, permit, completion)
- Auto-create calendar events
- **Effort:** Small

---

## PHASE 5: Seed Data

### 5A. 🔴 Seed Lead Statuses (9 defaults)
### 5B. 🔴 Seed Example Reminders (5 demo items)
### 5C. 🔴 Seed AI Notifications (5 demo items)

---

## Implementation Order

| Step | Feature | ID | Effort |
|------|---------|-----|--------|
| 1 | Seed Lead Statuses | 1C | Small |
| 2 | Building Owner Field | 1A | Small |
| 3 | Primary Contact | 1B | Small |
| 4 | Retainer Carry-Through | 1G | Small |
| 5 | Manual Reminders (DB + hooks + UI) | 3A | Medium |
| 6 | PM Daily Dashboard | 2A | Large |
| 7 | AI-Generated Reminders | 3B | Medium |
| 8 | Filing Checklist Editable | 1D | Medium |
| 9 | Add Team Member | 1E | Medium |
| 10 | Documents Drag-and-Drop | 1F | Medium |
| 11 | Admin Dashboard Enhancements | 2B | Medium |
| 12 | Project Readiness Checklist | 4B | Medium |
| 13 | Project Summary on Demand | 3C | Medium |
| 14 | Assignment Notifications | 4A | Small |
| 15 | Timeline Setup | 4C | Small |
| 16 | Seed Reminders + AI Notifications | 5B/5C | Small |
