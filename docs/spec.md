# Ordino MVP Specification

**Version**: 1.0.0  
**Spec ID**: 001-ordino-mvp  
**Timeline**: 36 weeks  
**Budget**: $94,000  
**Target Users**: Green Light Expediting (5 PMs + 2 admins)  
**Success Metric**: 90%+ billable time logged within 24 hours  

---

## Executive Summary

### The Problem
Green Light Expediting has a $300K Laravel permit tracking system that PMs don't consistently use because:
- Time logging feels like homework (happens days/weeks late = revenue leakage)
- Too much manual data entry (double/triple entry across systems)
- Desktop-only (PMs work from phones 80% of the time)
- No AI assistance (PMs waste hours on follow-ups, reports, objection responses)
- Single-tenant (can't sell to other expediters)

**Impact**: ~30% of billable time never gets logged = $200K+ annual revenue leakage

### The Solution
Clean rebuild as **mobile-first, AI-powered, multi-tenant SaaS** that:
1. **Meets PMs where they work** - Chrome extension sidebar in DOB NOW
2. **Captures time naturally** - Auto-detect, 3-tap logging, voice notes
3. **Eliminates manual work** - AI reads documents, drafts follow-ups, generates reports
4. **Works offline** - Subway, elevators, basements (common PM environments)
5. **Sells to others** - Multi-tenant architecture, vendor marketplace revenue

### Success Criteria
**Must Achieve (or MVP fails)**:
- ✅ 90%+ billable time logged within 24 hours (vs 70% current)
- ✅ 5+ daily logins per PM (vs 1-2 current)
- ✅ 80%+ of PMs use DOB NOW extension weekly
- ✅ 50%+ time reduction on proposals, reports, follow-ups
- ✅ 99%+ uptime (PMs depend on it for daily work)

**Nice to Have (v1.1 targets)**:
- 10 beta customers willing to pay $300-500/month
- Vendor network generating $10K+/month in referral fees
- AI approval rate >80% (minimal PM editing needed)

---

## User Personas

### Primary: Sheri (Project Manager)
**Role**: Handles 15-20 active DOB applications  
**Daily Workflow**:
- 8:00 AM - Clock in, check urgent items
- 8:30-10:00 - DOB NOW (check statuses, file amendments)
- 10:00-12:00 - Client calls, architect coordination
- 12:00-1:00 - Lunch (often working)
- 1:00-3:00 - Site visits, inspections
- 3:00-5:00 - More DOB work, objection responses
- 5:00 PM - Auto clock-out reminder

**Pain Points**:
- "I forget to log time until end of week"
- "Switching between Ordino and DOB NOW is annoying"
- "Writing status emails to clients takes 30 min each"
- "I don't remember which examiner I talked to last month"
- "Creating proposals manually takes an hour"

**Goals**:
- Log time without thinking about it
- Never lose track of a project
- Spend more time on high-value work (relationships)
- Look professional to clients (fast, proactive updates)

### Secondary: Sai (Accounting/Office Manager)
**Role**: Billing, invoicing, QuickBooks management  
**Daily Workflow**:
- Review completed work
- Create invoices in QuickBooks
- Send invoices to clients
- Track payments
- Generate financial reports

**Pain Points**:
- "PMs don't tell me when work is done"
- "I have to ask 3 times before they log their time"
- "Reconciling Ordino vs QuickBooks is tedious"
- "Creating invoices from PM notes is error-prone"

**Goals**:
- Know immediately when services are billable
- Auto-sync with QuickBooks (no double-entry)
- Accurate time tracking (trust the data)
- Fast invoicing (same day as completion)

### Tertiary: Chris (Owner/Manager)
**Role**: Business oversight, hiring, client relationships  
**Daily Workflow**:
- Check project statuses
- Review PM workload distribution
- Client escalations
- Pricing strategy
- Financial performance

**Pain Points**:
- "I don't know what PMs are working on real-time"
- "Which PMs are overloaded? Which have capacity?"
- "Are we charging enough for our services?"
- "Client asks for status, I have to bug PM"

**Goals**:
- Dashboard visibility into all projects
- Balance workload across team
- Data-driven pricing decisions
- Proactive client communication

### Future: Spencer (Client - Property Owner)
**Role**: Owns multiple properties, needs permits  
**Not in MVP, but design for it**

**Pain Points**:
- "I don't know permit status without calling"
- "Email updates are irregular"
- "I can't see what I'm being billed for"

**Goals**:
- Check status anytime (self-service portal)
- Proactive updates (no need to ask)
- Transparency on billing

---

## Core User Stories

### Epic 1: Frictionless Time Tracking

#### Story 1.1: Auto Clock-In Reminder
**As a** PM  
**I want** automatic clock-in reminder at 8 AM  
**So that** I never forget to clock in (happens 20% of days currently)

**Acceptance Criteria**:
- [ ] Push notification at 8:00 AM (if not clocked in)
- [ ] Second reminder at 8:15 AM (if still not clocked in)
- [ ] One-tap "Clock In Now" from notification
- [ ] Works even if app not open (background notification)
- [ ] Respects user's preferred start time (configurable)

**Edge Cases**:
- PM on vacation (no notification)
- PM already clocked in (no notification)
- PM works flexible hours (custom start time)

#### Story 1.2: Three-Tap Time Logging
**As a** PM  
**I want** to log time in <30 seconds from my phone  
**So that** I can log immediately after finishing work (vs waiting until end of day)

**Acceptance Criteria**:
- [ ] Open app → Shows recent projects (no search needed)
- [ ] Tap project → Quick action buttons appear
- [ ] Tap action (e.g., "Called DOB - 15 min") → Saved
- [ ] Total: 3 taps, <10 seconds
- [ ] Works offline (syncs when back online)

**UI Flow**:
```
Home Screen (Mobile):
┌──────────────────────────────┐
│ 🔴 Clocked In: 3h 45m        │
├──────────────────────────────┤
│ RECENT PROJECTS:             │
│ [689 5th Ave - Fire Alarm]   │ ← Tap 1
│ [Queens Blvd - Sprinkler]    │
│ [Broadway - Elevator]        │
└──────────────────────────────┘

Project Screen:
┌──────────────────────────────┐
│ 689 5th Ave - Fire Alarm     │
│ Job #421639356               │
├──────────────────────────────┤
│ QUICK LOG:                   │
│ [📞 Called DOB]    15m       │ ← Tap 2
│ [📧 Emailed Client] 10m      │
│ [📋 Reviewed Plans] 30m      │
│ [+ Custom...]                │
└──────────────────────────────┘

Confirmation:
┌──────────────────────────────┐
│ ✅ Logged: Called DOB (15m)  │ ← Tap 3 (confirm)
│ Total today: 4h 0m           │
│                              │
│ Add note (optional):         │
│ [________________]           │
│ [Save] [Cancel]              │
└──────────────────────────────┘
```

#### Story 1.3: Voice Note Time Logging
**As a** PM in my car after a site visit  
**I want** to record a voice note instead of typing  
**So that** I can log time safely while driving

**Acceptance Criteria**:
- [ ] Tap microphone icon → Start recording
- [ ] Speak naturally: "Spent 45 minutes at 689 5th Avenue inspecting fire alarm conduit"
- [ ] AI transcribes voice to text (Whisper API)
- [ ] AI extracts: Project (689 5th), Activity (inspection), Duration (45 min)
- [ ] Auto-creates time entry (PM can edit/approve)
- [ ] Works offline (uploads when connection restored)

**Example Voice Notes**:
- "Called examiner John Smith about the sprinkler objection for 15 minutes"
- "Two hour site visit at Queens Boulevard, met with contractor"
- "30 minute client call with Spencer about the permit delay"

**AI Extraction**:
```
Voice: "Spent 45 minutes at 689 5th Avenue inspecting fire alarm conduit"
↓
AI Extracts:
- Property: 689 5th Avenue
- Project: Fire Alarm (matched)
- Activity: Site inspection
- Duration: 45 minutes
- Notes: "inspecting fire alarm conduit"
↓
Creates Draft Time Entry:
Project: #7706 - 689 5th Ave - Fire Alarm
Service: Inspections Coordination
Duration: 45 min
Notes: "Site inspection - fire alarm conduit"
Status: Pending PM approval
```

#### Story 1.4: Auto Clock-Out Reminder
**As a** PM  
**I want** automatic clock-out reminder at 5 PM  
**So that** I don't forget to clock out (happens 30% of days currently)

**Acceptance Criteria**:
- [ ] Notification at 5:00 PM (if still clocked in)
- [ ] Shows hours worked today
- [ ] One-tap "Clock Out Now"
- [ ] If no response by 5:30 PM, auto-clock-out (with notification)
- [ ] Can dismiss if working late (custom clock-out later)

---

### Epic 2: DOB NOW Chrome Extension (THE Stickiness Feature)

#### Story 2.1: Open DOB NOW from Ordino
**As a** PM  
**I want** to open DOB NOW for a project with one click  
**So that** context is maintained between Ordino and DOB

**Acceptance Criteria**:
- [ ] Every application has "Open in DOB NOW" button
- [ ] Click button → Opens DOB NOW in new tab
- [ ] URL includes job number (auto-fills BIS search)
- [ ] Ordino sidebar auto-appears on right side
- [ ] Timer starts automatically (tracking time on this job)

**Technical Handoff** (for plan.md):
- Pass job number via URL param
- Chrome extension detects Ordino context
- Injects sidebar iframe

#### Story 2.2: Sidebar Shows Project Context
**As a** PM working in DOB NOW  
**I want** to see Ordino project info without leaving DOB  
**So that** I have context while reviewing DOB data

**Acceptance Criteria**:
- [ ] Sidebar shows: Project name, job number, client, PM assigned
- [ ] Shows recent activity (last 5 actions)
- [ ] Shows next due item (e.g., "Objection response due 1/22")
- [ ] Shows linked services (which are billable)
- [ ] Collapsible (minimize to edge if needed)

**UI**:
```
┌─ Ordino Sidebar ────────────┐
│ 689 5th Ave - Fire Alarm    │
│ Job #421639356              │
│ Client: Spencer Dev         │
│ PM: Sheri                   │
├─────────────────────────────┤
│ ⏱️ Timer: 00:15:23          │
│ [Pause] [Stop & Log]        │
├─────────────────────────────┤
│ NEXT DUE:                   │
│ 🔴 Objection response (1/22)│
├─────────────────────────────┤
│ RECENT:                     │
│ • 9:15 AM - Called (12m)    │
│ • 9:30 AM - Review (8m)     │
│ • Yesterday - Email sent    │
└─────────────────────────────┘
```

#### Story 2.3: Quick Actions Without Leaving DOB
**As a** PM  
**I want** to log time/notes from DOB NOW sidebar  
**So that** I don't have to switch between apps

**Acceptance Criteria**:
- [ ] Quick action buttons in sidebar
- [ ] One-click: "Called DOB" (auto-fills 15 min, editable)
- [ ] One-click: "Emailed Client" (10 min)
- [ ] One-click: "Reviewed Application" (30 min)
- [ ] Custom action: Type activity, select duration
- [ ] Add note (optional text field)
- [ ] All saves to Ordino in real-time

#### Story 2.4: Auto Time Tracking
**As a** PM  
**I want** timer to auto-start when I open DOB NOW for a project  
**So that** I never forget to track time spent in DOB

**Acceptance Criteria**:
- [ ] Timer starts when DOB NOW opens (from Ordino context)
- [ ] Timer continues if I switch DOB NOW tabs (same job)
- [ ] Timer pauses if I leave DOB NOW (switch to different site)
- [ ] Timer stops when I close DOB NOW tab
- [ ] On close: Prompt "Log 15 minutes to 689 5th Ave?" (quick confirm)
- [ ] Can edit duration before saving

**Edge Cases**:
- Multiple DOB NOW tabs open (different jobs) → Each tracked separately
- Close tab without logging → Draft time entry created (can approve later)
- Internet disconnected → Queue locally, sync when back online

---

### Epic 3: Spreadsheet-Style Proposal Builder

#### Story 3.1: Create Proposal with Table UI
**As a** PM  
**I want** to build proposals in a spreadsheet-like interface  
**So that** it's fast and familiar (like Excel, NOT drag-and-drop)

**Acceptance Criteria**:
- [ ] New proposal → Opens blank table with rows
- [ ] Columns: Job#, Service, Est Hours, Rate, Amount, Actions
- [ ] Click "Service" cell → Type-ahead dropdown appears
- [ ] Type "Fire" → Shows "Fire Alarm Filing", "Fire Suppression", etc.
- [ ] Select service → Auto-fills Est Hours and Rate from catalog
- [ ] Amount auto-calculates (hours × rate)
- [ ] Live total at bottom
- [ ] Tab key moves to next cell (Excel-like)

**UI**:
```
Proposal Builder - 689 5th Avenue
Client: Spencer Development | Project Type: Fire Alarm

┌────────────────────────────────────────────────────────────┐
│ Job# │ Service ↓          │ Hrs  │ Rate  │ Amount    │ ✕   │
├──────┼────────────────────┼──────┼───────┼───────────┼─────┤
│      │ [Type to search...] │      │       │           │     │
├──────┼────────────────────┼──────┼───────┼───────────┼─────┤
│ 4216 │ Application Filing │ 3.5  │ $225  │  $787.50  │ ✕   │
│ 4216 │ Plan Review        │ 8.0  │ $225  │ $1,800.00 │ ✕   │
│ 4216 │ TR-1 Coordination  │ 2.0  │ $225  │  $450.00  │ ✕   │
│ 4217 │ DOB Inspection     │ 4.0  │ $225  │  $900.00  │ ✕   │
├──────┴────────────────────┴──────┴───────┴───────────┴─────┤
│                                    TOTAL:     $3,937.50     │
└────────────────────────────────────────────────────────────┘

[+ Add Row] [Save Draft] [Preview PDF] [Send to Client]
```

#### Story 3.2: Smart Service Catalog
**As a** PM  
**I want** auto-complete to suggest services with historical pricing  
**So that** I don't have to remember exact names or typical hours

**Acceptance Criteria**:
- [ ] Type partial name → Shows matching services
- [ ] Each option shows: Service name, avg hours, avg rate
- [ ] Shows "You typically charge $X for this" (based on past proposals)
- [ ] Can override hours/rate (editable cells)
- [ ] Warning if >30% different from average (e.g., "Usually 3.5 hrs, you entered 10 hrs")

**Example**:
```
Type: "fire"

Dropdown shows:
┌──────────────────────────────────────────────┐
│ Fire Alarm Filing - ALT-2                    │
│ Avg: 3.5 hrs @ $225/hr = $788               │
│ Your history: Used 12 times, avg $750       │
├──────────────────────────────────────────────┤
│ Fire Suppression - Sprinkler                 │
│ Avg: 5.0 hrs @ $225/hr = $1,125             │
│ Your history: Used 8 times, avg $1,100      │
└──────────────────────────────────────────────┘
```

#### Story 3.3: Keyboard Shortcuts (Excel-Like)
**As a** PM  
**I want** keyboard shortcuts like Excel  
**So that** I can build proposals fast without touching mouse

**Acceptance Criteria**:
- [ ] Tab: Move to next cell
- [ ] Shift+Tab: Move to previous cell
- [ ] Enter: Move to cell below
- [ ] Ctrl+D: Duplicate current row
- [ ] Ctrl+Arrow: Jump to first/last row
- [ ] Delete: Clear cell contents
- [ ] Ctrl+S: Save draft

#### Story 3.4: Job Number Grouping
**As a** PM  
**I want** services to group by job number visually  
**So that** I can see which services belong to which DOB application

**Acceptance Criteria**:
- [ ] Services with same job# show in collapsed section
- [ ] Click to expand/collapse section
- [ ] Subtotal per job number
- [ ] Can reorder sections (drag job groups up/down)

**UI**:
```
▼ Job #421639356 (Subtotal: $3,037.50)
  • Application Filing - $787.50
  • Plan Review - $1,800.00
  • TR-1 Coordination - $450.00

▼ Job #421639357 (Subtotal: $900.00)
  • DOB Inspection - $900.00

────────────────────────────────────
TOTAL: $3,937.50
```

---

### Epic 4: Property Hierarchy

#### Story 4.1: See All Jobs at One Address
**As a** PM  
**I want** to see all DOB applications for a property  
**So that** I understand full project scope and history

**Acceptance Criteria**:
- [ ] Click property address anywhere → Property detail page
- [ ] Shows all applications (past and present)
- [ ] Grouped by status: Active, Completed, Archived
- [ ] Each application shows: Job#, type, status, PM, billed amount
- [ ] Summary: Total apps, total billed, days since first app

**UI**:
```
Property: 689 5th Avenue, Manhattan
Block: 1284 | Lot: 45 | BIN: 1089756
Owner: Spencer Development

APPLICATIONS (3 total, 2 active)

▼ ACTIVE (2)
┌─────────────────────────────────────────────────┐
│ Job #421639356 - Fire Alarm Installation        │
│ Status: Permit Issued 🟢 | Filed: 8/10/18       │
│ PM: Sheri | Billed: $4,275 | Days open: 527     │
│ [View Details]                                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Job #421548877 - Sprinkler System                │
│ Status: Under Review 🟡 | Filed: 3/15/19        │
│ PM: Natalia | Billed: $3,200 | Days open: 23    │
│ [View Details]                                   │
└─────────────────────────────────────────────────┘

▼ COMPLETED (1)
┌─────────────────────────────────────────────────┐
│ Job #422001234 - Elevator Modernization          │
│ Status: Closed ✅ | Filed: 11/2/20 | PM: Mario  │
│ Billed: $8,900 | Completed: 89 days             │
│ [View Details]                                   │
└─────────────────────────────────────────────────┘

SUMMARY:
Total Billed: $16,375 | Average days: 213
Most common PM: Sheri (2 of 3 apps)
```

#### Story 4.2: Navigate Property → Application → Service
**As a** PM  
**I want** clear hierarchy navigation  
**So that** I understand where I am in the system

**Acceptance Criteria**:
- [ ] Breadcrumb navigation: Properties > 689 5th Ave > Job #421639356 > Services
- [ ] Click any breadcrumb level to go back
- [ ] Property search shows properties (not individual applications)
- [ ] Can bookmark/favorite properties (for repeat clients)

#### Story 4.3: Property-Level Client Communication
**As a** PM  
**I want** to see all communication for a property  
**So that** I don't miss context from other applications

**Acceptance Criteria**:
- [ ] Property page shows communication timeline (all apps)
- [ ] Can filter: Emails, Calls, Meetings, AI follow-ups
- [ ] Can filter by application or show all
- [ ] Click communication → Opens full thread

---

### Epic 5: AI Document Intelligence

#### Story 5.1: Upload Objection Letter → Auto-Create Tasks
**As a** PM  
**I want** to upload DOB objection PDF and have AI extract issues  
**So that** I don't spend 20-30 min manually reading and creating tasks

**Acceptance Criteria**:
- [ ] Upload PDF (or drag-and-drop)
- [ ] AI processes in <10 seconds
- [ ] AI extracts: Document type, job number, issues, deadlines
- [ ] Auto-creates task for each issue
- [ ] Auto-assigns to PM on the application
- [ ] PM can review/edit before confirming

**Example**:
```
Upload: "DOB_Objection_421639356.pdf"
↓
AI Processing... (5 seconds)
↓
AI Found:
📄 Document Type: Objection Letter
🏗️ Job Number: 421639356
📅 Response Due: January 22, 2026
⚠️ Issues Identified (3):

1. Missing structural calculations for beam support
   → Auto-created task: "Submit structural calcs"
   → Assigned to: Sheri
   → Due: January 22, 2026

2. Egress door width non-compliant (34" vs 36" required)
   → Auto-created task: "Revise egress door detail"
   → Assigned to: Sheri
   → Due: January 22, 2026

3. Fire-rated assembly not shown on plans
   → Auto-created task: "Add fire rating detail to sheet A-5"
   → Assigned to: Sheri
   → Due: January 22, 2026

[Confirm All] [Edit Tasks] [Cancel]
```

#### Story 5.2: AI Suggests Response Template
**As a** PM  
**I want** AI to draft objection response  
**So that** I have a starting point (not blank page)

**Acceptance Criteria**:
- [ ] After extracting issues, AI offers "Generate Response"
- [ ] AI drafts professional response addressing each issue
- [ ] Includes: Acknowledgment, plan of action, timeline
- [ ] PM can edit before sending
- [ ] Saves draft to project

**Example AI Response**:
```
Subject: Response to Objection - Job #421639356 (689 5th Avenue)

Dear Examiner,

Thank you for your review of our Fire Alarm application (Job #421639356).
We have reviewed the objections and will address each item as follows:

1. STRUCTURAL CALCULATIONS FOR BEAM SUPPORT
   → Our structural engineer is preparing calculations for the beam
      modification shown on Sheet S-3. We will submit these by January 20, 2026.

2. EGRESS DOOR WIDTH
   → Revised architectural plans showing compliant 36" door width will be
      submitted by January 20, 2026 (see Sheet A-7).

3. FIRE-RATED ASSEMBLY
   → Detail 5/A-5 has been added to plans showing 2-hour fire-rated
      wall assembly per NYC Building Code Section 706.

We anticipate submitting all revised documents by January 20, 2026,
ahead of the January 22nd deadline.

Please let us know if you need any additional information.

Best regards,
Sheri Martinez
Green Light Expediting
```

#### Story 5.3: Search Similar Past Objections
**As a** PM responding to objection  
**I want** AI to show how similar objections were resolved in the past  
**So that** I can learn from successful approaches

**Acceptance Criteria**:
- [ ] AI searches past objections for similar keywords
- [ ] Shows: Project, date, how it was resolved, outcome
- [ ] Can click to view full objection + response
- [ ] Learns over time (improves matching)

**Example**:
```
🔍 Similar Past Objections:

Job #420987654 - 123 Main St (8 months ago)
Issue: "Egress width non-compliant"
Resolution: "Revised door from 34" to 36", resubmitted detail A-7"
Outcome: ✅ Approved in 3 days
[View Full Details]

Job #419876543 - 456 Park Ave (1 year ago)
Issue: "Structural calcs missing for beam"
Resolution: "Engineer submitted calcs with PE stamp"
Outcome: ✅ Approved in 5 days
[View Full Details]
```

---

### Epic 6: Examiner Intelligence Database

#### Story 6.1: Capture Examiner Interactions (Passive)
**As a** PM  
**I want** system to track which examiner I worked with  
**So that** institutional knowledge is captured (not just in my head)

**Acceptance Criteria**:
- [ ] When logging activity, optional field: "Examiner name"
- [ ] Auto-complete suggests examiners from past interactions
- [ ] Captures: Name, date, outcome (approved/objection/pending), notes
- [ ] No extra work required (just autocomplete field)

**UI**:
```
Log Activity:
Activity: [Called DOB]
Duration: [15 min]
Examiner: [John Smith ↓] ← Optional autocomplete
Outcome: [Approved ↓] ← Optional
Notes: [Got verbal approval, waiting for official letter]

[Save]
```

#### Story 6.2: Show Examiner Profile When Assigned
**As a** PM  
**I want** to see examiner history when I'm assigned one  
**So that** I know what to expect and how to approach

**Acceptance Criteria**:
- [ ] When examiner assigned (from DOB), show profile card
- [ ] Profile shows: Approval rate, avg review time, common issues
- [ ] Shows tips based on past interactions
- [ ] Shows past projects with this examiner

**UI**:
```
┌─ Examiner Assigned: John Smith ────────────────┐
│                                                 │
│ ⚠️ HEADS UP:                                    │
│ John has a 67% approval rate (vs 82% average)  │
│ Avg review time: 23 days (vs 18 days average)  │
│                                                 │
│ COMMON OBJECTIONS:                              │
│ • Requires wet stamps (not digital) - 73%      │
│ • Strict on egress widths - 45%                │
│ • Often requests additional calcs - 38%        │
│                                                 │
│ 💡 TIPS FROM YOUR TEAM:                         │
│ "Call him Tuesdays 10-11 AM for best response" │
│ "Email plans first, then follow up with call"  │
│ "Include extra details proactively"            │
│                                                 │
│ YOUR HISTORY WITH JOHN: 12 projects             │
│ ✅ Approved: 8 | ❌ Objection: 4                │
│                                                 │
│ [View All Interactions]                         │
└─────────────────────────────────────────────────┘
```

#### Story 6.3: Learn from Team's Collective Experience
**As a** PM  
**I want** to benefit from other PMs' examiner experiences  
**So that** new PMs aren't starting from scratch

**Acceptance Criteria**:
- [ ] Examiner profiles aggregate across all PMs (company-wide)
- [ ] Shows: "Natalia had success calling in morning", "Mario got approved after 2 revisions"
- [ ] Privacy: No specific client/project names (just patterns)
- [ ] Can add tips manually (e.g., "John prefers stamped calcs upfront")

---

### Epic 7: Collapsible Requirements Table

#### Story 7.1: Visual Progress Checklist
**As a** PM  
**I want** to see all DOB requirements as a checklist  
**So that** I know exactly what's done and what's next

**Acceptance Criteria**:
- [ ] Each application shows requirements checklist
- [ ] Default requirements based on application type (FA, ALT-2, etc.)
- [ ] Can add custom requirements
- [ ] Visual: ✅ Complete, ⏳ In Progress, ⏱️ Not Started
- [ ] Progress bar: "3 of 8 complete (38%)"

**UI**:
```
▼ DOB Requirements Checklist (3 of 8 complete - 38%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 38%

Item                   Status      Due        Assigned
─────────────────────────────────────────────────────────
✅ Application Filed   Complete    -          Sheri
✅ Plans Approved      Complete    -          DOB
✅ Permit Issued       Complete    -          DOB
✅ TR-1 Inspection     Complete    -          Agency
⏳ Resolve Objection  URGENT 🔴   1/22/26    Sheri
⏱️ TR-8 HVAC          Pending     2/15/26    TBD
⏱️ Final Sign-off     Pending     TBD        DOB
⏱️ CO Issuance        Pending     TBD        DOB
```

#### Story 7.2: Link Requirements to Services (Billing)
**As a** PM  
**I want** to see which services are tied to which requirements  
**So that** I know what's billable when requirement completes

**Acceptance Criteria**:
- [ ] Each requirement can link to service(s)
- [ ] When requirement marked complete → Service becomes billable
- [ ] Shows: Service name, amount, billing status
- [ ] Can click to view service details

**UI**:
```
⏳ Resolve Objection - URGENT 🔴 (Due: 1/22/26)
   └─ Missing: Structural calcs for beam support
   └─ 🤖 AI sent reminder to architect on 1/19
   
   📊 Linked Services:
   • Objection Response - $450 [Not billed yet]
   • Plan Revisions - $200 [Not billed yet]
   
   [Request Plans] [Call Architect] [Mark Complete]
```

#### Story 7.3: AI Actions Shown Inline
**As a** PM  
**I want** to see what AI agent did for each requirement  
**So that** I know if follow-ups happened automatically

**Acceptance Criteria**:
- [ ] Requirements show AI actions inline
- [ ] Example: "🤖 AI sent follow-up email on 1/19"
- [ ] Can click to view AI email content
- [ ] Can see if client responded (email thread)

---

### Epic 8: QuickBooks Online Integration

#### Story 8.1: Auto-Create Draft Invoices in QBO
**As** Sai (accounting)  
**I want** completed services to auto-create draft invoices in QuickBooks  
**So that** I don't manually re-enter data

**Acceptance Criteria**:
- [ ] PM marks service "Complete" in Ordino
- [ ] System creates DRAFT invoice in QuickBooks (not sent yet)
- [ ] Invoice includes: Client name, service description, amount
- [ ] Sai reviews/edits in QuickBooks
- [ ] Sai approves → Sends to client from QuickBooks
- [ ] Payment status syncs back to Ordino

**Workflow**:
```
Ordino:
PM marks "Application Filing - $800" as Complete
↓
QuickBooks (auto-created):
DRAFT Invoice #12345
To: Spencer Development
Line 1: Application Filing - 689 5th Ave - $800.00
Status: DRAFT (not sent)
↓
Sai reviews in QuickBooks:
Looks good → Click "Send"
↓
QuickBooks sends invoice to client
↓
Webhook to Ordino:
Invoice #12345 status: SENT
↓
Client pays
↓
Webhook to Ordino:
Invoice #12345 status: PAID
```

#### Story 8.2: Percentage-Based Billing
**As** Sai  
**I want** to bill services in milestones (50% now, 50% later)  
**So that** cash flow matches work progress

**Acceptance Criteria**:
- [ ] Service can have billing milestones
- [ ] Example: "50% on approval, 50% on completion"
- [ ] First milestone hit → Create first invoice
- [ ] Second milestone hit → Create second invoice
- [ ] Both invoices link to same service

**Example**:
```
Service: Inspections Coordination - $1,200
Milestones:
  1. Upon Permit Approval - 50% ($600)
  2. Upon Final Sign-off - 50% ($600)

Timeline:
8/24/18: Permit approved
  → Auto-creates Invoice #12345 for $600 (sent)
  
9/15/18: Final sign-off complete
  → Auto-creates Invoice #12789 for $600 (sent)
```

#### Story 8.3: Two-Way Sync (Payment Status)
**As a** PM  
**I want** to see payment status in Ordino  
**So that** I know if client paid (without asking accounting)

**Acceptance Criteria**:
- [ ] Service shows: Not Billed, Invoiced, Paid, Overdue
- [ ] Updates in real-time from QuickBooks (webhook)
- [ ] Can click to view invoice in QuickBooks
- [ ] Overdue invoices highlighted (>30 days)

---

### Epic 9: AI Follow-Up Agent

#### Story 9.1: AI Sends First Follow-Up (PM Approval Required)
**As a** PM  
**I want** AI to draft follow-up emails when deadlines approach  
**So that** I don't forget to chase clients/architects

**Acceptance Criteria**:
- [ ] When item pending >3 days → AI drafts follow-up
- [ ] PM gets notification: "AI drafted follow-up for 689 5th Ave"
- [ ] PM reviews email, can edit
- [ ] PM approves → Email sent (or PM can decline)
- [ ] If PM doesn't respond in 24 hrs → AI escalates (no auto-send)

**Example**:
```
🤖 AI DRAFTED FOLLOW-UP

To: Spencer Development
Subject: Following up - 689 5th Ave Fire Alarm Application

Hi Spencer,

Just following up on the fire alarm application for 689 5th Avenue.
We sent the application for your signature 3 days ago.

Could you please review and sign when you get a chance?
This will allow us to file with DOB and keep the project on schedule.

Let me know if you have any questions.

Best,
Sheri

[✅ Approve & Send] [✏️ Edit] [❌ Decline]
```

#### Story 9.2: AI Escalates After 2 Attempts
**As a** PM  
**I want** AI to escalate if client doesn't respond after 2 follow-ups  
**So that** I know when personal intervention is needed

**Acceptance Criteria**:
- [ ] AI sends first follow-up (PM approves)
- [ ] Day 3: No response → AI drafts second (more urgent tone)
- [ ] Day 7: Still no response → AI alerts PM "Manual intervention needed"
- [ ] Shows what AI already tried (email history)
- [ ] Suggests next action: "Call client" or "Escalate to Chris"

**Escalation Alert**:
```
🔴 ESCALATION NEEDED

Project: 689 5th Ave - Fire Alarm
Issue: Client hasn't signed application (7 days)

AI ACTIONS TAKEN:
• 1/17: Sent polite reminder ✅ (No response)
• 1/19: Sent urgent follow-up ✅ (No response)

SUGGESTED NEXT STEPS:
1. Call Spencer directly (preferred)
2. Email Chris to escalate
3. Hold project (if client unresponsive)

[Call Client] [Email Chris] [Mark Resolved]
```

#### Story 9.3: AI Learns from PM Edits
**As a** PM  
**I want** AI to improve based on my edits  
**So that** future drafts need less editing

**Acceptance Criteria**:
- [ ] When PM edits AI email → System logs changes
- [ ] AI learns: Tone preferences, phrasing, level of detail
- [ ] Over time: PM approval rate increases (less editing)
- [ ] Shows: "AI accuracy: 85% (17 of 20 approved without edit)"

---

### Epic 10: Client Reporting

#### Story 10.1: One-Click Status Report
**As a** PM  
**I want** to generate client status report in <10 seconds  
**So that** I can respond to "what's the status?" emails instantly

**Acceptance Criteria**:
- [ ] Click "Generate Report" on any project
- [ ] AI compiles: Current status, next steps, timeline, recent activity
- [ ] Formatted professionally (PDF + email body)
- [ ] PM reviews/edits (optional)
- [ ] Click "Send" → Email to client with PDF attached

**Generated Report Example**:
```
STATUS REPORT: 689 5th Avenue - Fire Alarm Installation
Project #7706 | Generated: January 20, 2026

CURRENT STATUS: Permit Issued ✅
Application filed with DOB on August 10, 2018
Permit issued on August 24, 2018 (14 days)

NEXT STEPS:
1. Resolve objection (structural calcs needed) - Due Jan 22
2. TR-8 HVAC Inspection - Scheduled for Feb 15
3. Final sign-off from DOB

TIMELINE:
✅ Application Filed - Aug 10, 2018
✅ Plans Approved - Aug 20, 2018
✅ Permit Issued - Aug 24, 2018
✅ TR-1 Inspection - Sep 15, 2018
⏳ Objection Response - Jan 22, 2026 (in progress)
⏱️ TR-8 Inspection - Feb 15, 2026 (scheduled)
⏱️ Final Sign-off - TBD

RECENT ACTIVITY:
• Jan 19: AI sent reminder to architect for calcs
• Jan 18: Sheri called examiner (John Smith)
• Jan 17: Objection letter received from DOB

Questions? Contact Sheri Martinez at sheri@gle.com

---
Green Light Expediting
greenlight-expediting.com
```

#### Story 10.2: Recurring Report Scheduler
**As a** PM  
**I want** to auto-send status reports weekly/monthly  
**So that** proactive clients get updates without asking

**Acceptance Criteria**:
- [ ] Can set report schedule: Weekly, Biweekly, Monthly
- [ ] AI generates report automatically
- [ ] PM gets preview notification (can edit before send)
- [ ] If PM doesn't edit within 24hrs → Auto-sends
- [ ] Client receives report via email

---

### Epic 11: NYC DOB Data Sync

#### Story 11.1: Nightly Status Sync from DOB
**As a** PM  
**I want** DOB statuses to sync automatically overnight  
**So that** I don't manually check BIS every morning

**Acceptance Criteria**:
- [ ] System syncs with NYC Open Data API nightly (2 AM)
- [ ] Updates: Filing status, permit status, inspection results
- [ ] Detects changes (approved, objection, inspection scheduled)
- [ ] Creates notifications for PMs in morning

**Morning Notification**:
```
🌅 GOOD MORNING, SHERI

Overnight Updates from DOB (3):

✅ Job #421639356 - Fire Alarm
   Status changed: Under Review → PERMIT ISSUED
   
⚠️ Job #421548877 - Sprinkler
   New objection letter posted
   
📅 Job #422001234 - Elevator
   Inspection scheduled: Feb 5 at 10 AM
```

#### Story 11.2: Auto-Update Requirements Table
**As a** PM  
**I want** requirements to auto-complete when DOB updates  
**So that** I don't manually mark things done

**Acceptance Criteria**:
- [ ] When DOB status = "Permit Issued" → Auto-check "Permit Issued" requirement
- [ ] When inspection passes → Auto-check inspection requirement
- [ ] When objection detected → Auto-create "Resolve Objection" requirement
- [ ] PM can override (if sync wrong)

---

## Out of Scope (Not in MVP)

### Explicitly NOT Included:
- ❌ Native mobile apps (iOS/Android) - PWA sufficient for MVP
- ❌ Client self-service portal - v1.1 feature
- ❌ Vendor network marketplace - v1.1 feature
- ❌ Advanced analytics/dashboards - Basic reporting only in MVP
- ❌ Multi-language support - English only
- ❌ Single sign-on (SSO) - Email/password only
- ❌ White-labeling - GLE branding only
- ❌ Public API - Internal use only for MVP
- ❌ Mobile app notifications - Web push only
- ❌ Offline file uploads >10MB - Require online connection
- ❌ Advanced AI (plan review, predictive analytics) - Post-MVP

### Deferred to v1.1:
- Examiner intelligence database (UI) - Data collection starts in MVP, UI in v1.1
- Slack bot commands - Integration exists, bot is v1.1
- Contact deduplication - Manual for now
- Task dependencies/Kanban - Simple task list sufficient
- Document version control - Basic uploads only
- Advanced reporting (20+ report types) - 3-5 basic reports in MVP

---

## Success Metrics (How We Measure MVP Success)

### Primary Metrics (Must Hit):
1. **Time Logging Rate**: 90%+ of billable time logged within 24 hours
   - Baseline: 70% (30% revenue leakage)
   - Target: 90%+ (10% leakage)
   - Measure: Weekly audit of logged hours vs expected hours

2. **Daily Active Usage**: 90%+ of PMs use Ordino daily
   - Baseline: 30% (PMs avoid desktop app)
   - Target: 90%+ (5+ logins per day)
   - Measure: Daily login count per PM

3. **DOB Extension Usage**: 80%+ of PMs use extension weekly
   - Baseline: 0% (doesn't exist)
   - Target: 80%+ active weekly users
   - Measure: Chrome extension telemetry

4. **Mobile Usage**: 60%+ of time entries from mobile
   - Baseline: 5% (desktop-only currently)
   - Target: 60%+ mobile time logs
   - Measure: Device type on time entries

### Secondary Metrics (Nice to Have):
5. **AI Approval Rate**: 80%+ of AI suggestions approved
   - Baseline: N/A (new feature)
   - Target: 80%+ approved without major edits
   - Measure: Approval vs rejection rate

6. **Proposal Speed**: 50% faster creation
   - Baseline: 60 min average
   - Target: 30 min average
   - Measure: Time from start to send

7. **Client Response Time**: <24 hours for status requests
   - Baseline: 48+ hours (manual compilation)
   - Target: <24 hours (one-click reports)
   - Measure: Time from request to response email

### Technical Health:
8. **Uptime**: 99.5%+
9. **Page Load**: <2 sec (mobile 4G)
10. **Error Rate**: <0.1%

---

## Risks & Mitigation

### Risk 1: PMs Don't Adopt Extension
**Impact**: High - Extension is core stickiness feature  
**Probability**: Medium - Chrome-only, requires install  
**Mitigation**:
- Onboarding: Force install during first week
- Value demo: Show timer auto-tracking live
- Fallback: Mobile app works without extension
- Monitor: Weekly usage dashboard

### Risk 2: AI Suggestions Too Inaccurate
**Impact**: High - PMs lose trust, stop using AI features  
**Probability**: Medium - GPT-4 is good but not perfect  
**Mitigation**:
- Start conservative (high confidence threshold)
- Human-in-loop (PM always approves)
- Learning loop (improve from rejections)
- Escape hatch (disable AI per-user if needed)

### Risk 3: QuickBooks Sync Breaks Accounting
**Impact**: Critical - Financial data must be accurate  
**Probability**: Low-Medium - Third-party API, edge cases  
**Mitigation**:
- DRAFT invoices only (never auto-finalize)
- Sai approval required before sending
- Manual override always available
- Daily sync validation report
- Rollback capability

### Risk 4: Offline Sync Conflicts
**Impact**: Medium - Lost data or duplicates  
**Probability**: Medium - Multiple devices, poor network  
**Mitigation**:
- Last-write-wins with timestamp
- Conflict detection UI (show PM both versions)
- Pessimistic locking on critical operations
- Background sync queue with retry

### Risk 5: Multi-Tenant Data Leak
**Impact**: Critical - Legal/compliance disaster  
**Probability**: Very Low - But catastrophic if happens  
**Mitigation**:
- Row-Level Security (RLS) enforced at DB
- Automated tests for isolation (every feature)
- Security audit before launch
- Penetration testing (external firm)

---

## Launch Plan

### Phase 1: Internal Alpha (Weeks 1-4)
**Users**: Manny + 1 PM (Sheri)  
**Goal**: Basic functionality works, find critical bugs  
**Scope**: Time tracking, proposals, projects (no AI yet)

**Success Criteria**:
- Zero data loss
- Can create proposal end-to-end
- Can log time via mobile
- No crashes for 7 consecutive days

### Phase 2: Team Beta (Weeks 5-8)
**Users**: All 5 PMs + Sai + Chris  
**Goal**: Full team daily usage, validate UX  
**Scope**: Add AI features, DOB extension, QBO sync

**Success Criteria**:
- 80%+ daily usage (all PMs)
- 50%+ time logged via extension
- AI approval rate >70%
- QBO sync working for 10+ invoices

### Phase 3: Production Launch (Week 9+)
**Users**: Full GLE team  
**Goal**: Replace Laravel system entirely  
**Migration**: Cutover weekend (Friday 5 PM freeze)

**Cutover Plan**:
```
Friday 5 PM:   Freeze Laravel (read-only mode)
Saturday 8 AM:  Run data migration script
Saturday 12 PM: Smoke test new Ordino with real data
Saturday 4 PM:  Team training session (2 hours)
Sunday:        Open for optional testing
Monday 8 AM:   Official go-live
```

**Safety Net**:
- Laravel stays read-only for 90 days (backup)
- Daily backups of new system
- Hotline for urgent issues (Manny's cell)
- Rollback plan (if critical failure in first 48 hours)

---

## Appendix A: User Interview Insights

**Sheri (PM) - 12/15/2025 Interview**:
- "I log time Friday afternoons when I remember, but I've already forgotten half of what I did"
- "Switching between tabs kills my flow - I just want to work in DOB NOW"
- "Voice notes while driving would be amazing - I lose so many billable minutes"
- "I know which examiners are difficult, but new PMs have to learn the hard way"

**Sai (Accounting) - 12/18/2025 Interview**:
- "I chase PMs for completed work - they forget to tell me when jobs are done"
- "QuickBooks and Ordino never match - I spend 2 hours reconciling weekly"
- "Percentage billing is manual hell - I create separate line items in QBO"

**Chris (Owner) - 12/20/2025 Interview**:
- "I can't see real-time utilization - who's slammed? Who has capacity?"
- "Client calls asking for status - I ping PM on Slack, wait for response, relay to client"
- "We're definitely underpricing some services, but I have no data to prove it"

---

## Appendix B: Competitor Analysis

### Existing Solutions:
1. **Procore** - Too construction-heavy, overkill for expediting
2. **BuilderTrend** - Residential focus, not NYC DOB specific
3. **Monday.com** - Generic project management, no domain knowledge
4. **Custom Spreadsheets** - What most expediters use (we did this)

### Our Differentiators:
- 🔥 **DOB NOW integration** - Nobody has this
- 🔥 **AI document intelligence** - Unique to our domain
- 🔥 **Examiner database** - Tribal knowledge captured
- 🔥 **NYC-specific** - Designed for NYC DOB workflow

---

**Document Control**:
- Version: 1.0.0
- Last Updated: February 3, 2026
- Next Review: After Weeks 1-4 (alpha feedback)
- Approved By: Manny Russell
- Related Docs: constitution.md, plan.md (to be created)
