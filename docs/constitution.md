# Ordino Constitution - Final Version

**Project**: Ordino - NYC Permit Expediting Platform  
**Organization**: Green Light Expediting LLC  
**Version**: 3.0.0 - Clean Rebuild  
**Last Updated**: February 3, 2026  
**Status**: Active - Ready for Implementation

---

## Preamble

This constitution establishes the non-negotiable principles governing Ordino's development, architecture, and evolution from clean rebuild through market validation. All specifications, plans, tasks, and implementations MUST comply with these principles. This document supersedes all previous documentation including the Laravel implementation.

**Core Mandate**: Transform permit expediting from manual chaos into AI-powered excellence while respecting what PMs actually do.

---

## Article I: Product Philosophy (NON-NEGOTIABLE)

### Section 1.1: The Stickiness Principle
**Success Definition**: When a PM says "I can't work without Ordino"

**How We Achieve This**:
1. **Meet PMs where they work** - DOB NOW sidebar, not separate app
2. **Capture time naturally** - Auto-detect work, 3-tap logging
3. **Eliminate double-entry** - Upload once, extract everything
4. **AI handles grunt work** - Follow-ups, summaries, reports
5. **Mobile-first always** - 80% of work happens on phone

**Failure States to Avoid**:
- ❌ "This feels like homework"
- ❌ "I forget to use it"
- ❌ "It's easier to do manually"
- ❌ "It slows me down"

### Section 1.2: AI as Force Multiplier (Not Replacement)
**Philosophy**: AI does the routine, PM does the relationships

**AI Responsibilities**:
- ✅ Read documents, extract data
- ✅ Draft follow-up emails
- ✅ Track examiner patterns
- ✅ Predict objections from plans
- ✅ Generate status reports
- ✅ Alert when projects go stale

**PM Responsibilities**:
- ✅ Final approval on all communications
- ✅ Relationship calls with clients/examiners
- ✅ Complex negotiations
- ✅ In-person meetings
- ✅ Strategic decisions

**Critical Rule**: PM ALWAYS has final say. AI suggests, PM decides.

### Section 1.3: Learn from $300K Laravel Investment
**What We Keep** (Business Logic):
- ✅ Proposal workflow that works
- ✅ Service pricing catalog
- ✅ Auto clock-in/out at 5PM
- ✅ E-signature flow
- ✅ Permission system structure
- ✅ Audit logging approach

**What We Fix** (Architecture):
- ❌ Single-tenant → Multi-tenant with RLS
- ❌ Desktop-only → Mobile-first PWA
- ❌ Manual everything → AI-powered
- ❌ Laravel/MySQL → React/Supabase/PostgreSQL
- ❌ No integrations → QuickBooks, NYC DOB, Gmail

**What We Add** (Differentiators):
- 🔥 DOB NOW Chrome extension with sidebar
- 🔥 AI document intelligence (read objections, create tasks)
- 🔥 Examiner intelligence database (tribal knowledge)
- 🔥 Collapsible requirements table (visual progress)
- 🔥 Property hierarchy (all jobs at address)
- 🔥 Vendor network marketplace

---

## Article II: Technical Stack (LOCKED - NO EXCEPTIONS)

### Section 2.1: Frontend Stack
```yaml
Framework: React 18+ with TypeScript 5+
Build Tool: Vite 5+
Styling: Tailwind CSS 3+ (utility-first, NO custom CSS)
Components: Shadcn/ui (accessible, customizable)
State Management:
  - Zustand (global state)
  - React Query v5 (server state, caching)
Forms: React Hook Form + Zod validation
Routing: React Router v6+
PWA: Workbox (offline support, background sync)
Charts: Recharts (for analytics)
Tables: TanStack Table v8 (for proposal builder)
```

### Section 2.2: Backend Stack
```yaml
Platform: Supabase (all-in-one backend)
Database: PostgreSQL 15+ with Row-Level Security (RLS)
API: Supabase Auto-generated REST (PostgREST)
Realtime: Supabase Realtime (WebSocket)
Auth: Supabase Auth (email/password, future SSO)
Storage: Supabase Storage (S3-compatible)
Functions: Supabase Edge Functions (Deno runtime)
```

### Section 2.3: AI & External Services
```yaml
AI Models:
  - Claude Sonnet 4.5: Primary AI (document analysis, follow-ups)
  - Claude Opus 4.5: Complex reasoning (plan review, predictions)
  - Whisper API: Voice transcription
  
Integrations:
  - QuickBooks Online: Invoice sync, payment tracking
  - NYC Open Data API: DOB status sync
  - Resend: Transactional emails
  - UploadCare: File storage (existing, keep)
  
Monitoring:
  - Sentry: Error tracking
  - PostHog: Product analytics
  - Uptime Robot: Status monitoring
  
Infrastructure:
  - Vercel: Frontend hosting, edge functions
  - Cloudflare: CDN, DDoS protection
  - Redis (Upstash): Rate limiting, caching
```

### Section 2.4: Prohibited Technologies
```yaml
❌ Laravel, Express, NestJS, FastAPI - Use Supabase only
❌ MySQL, MongoDB, Firebase - PostgreSQL only
❌ GraphQL - Use PostgREST REST API
❌ Redux, MobX, Recoil - Use Zustand + React Query
❌ Class components - Functional components only
❌ CSS-in-JS (styled-components) - Tailwind only
❌ Custom auth - Supabase Auth only
❌ Websockets lib - Supabase Realtime only
```

**Why Locked?** 
- Lovable optimized for this exact stack
- Clean rebuild = no legacy constraints
- Multi-tenant requires PostgreSQL RLS
- Mobile PWA needs modern React
- Team velocity 10x with consistent stack

---

## Article III: Architecture Principles

### Section 3.1: Multi-Tenant from Day 1 (NON-NEGOTIABLE)
**Every table MUST have company_id**:

```sql
-- REQUIRED on ALL tables
CREATE TABLE {table_name} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  -- other columns...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REQUIRED Row-Level Security
CREATE POLICY company_isolation ON {table_name}
  USING (company_id = auth.jwt() ->> 'company_id');
  
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
```

**Testing Requirement**:
Every feature MUST include multi-tenant isolation test:
```typescript
describe('Multi-tenant isolation', () => {
  it('Company A cannot see Company B data', async () => {
    // Create data for Company A
    // Login as Company B user
    // Assert: Cannot see Company A data
  });
});
```

### Section 3.2: Data Hierarchy (CRITICAL)
```
Companies (multi-tenant root)
  └─ Users (team members)
  └─ Properties (buildings/addresses)
      └─ DOB Applications (job numbers)
          └─ Services (work items, billable)
              └─ Activities (time logs, notes, calls)
                  └─ AI Actions (follow-ups, summaries)
```

**Key Relationships**:
- Property → Multiple Applications (689 5th Ave has 3 jobs)
- Application → Multiple Services (FA filing has filing + review + inspection)
- Service → Multiple Activities (time logs, notes, status updates)
- Everything chains to company_id

### Section 3.3: Offline-First Architecture
**Mobile Reality**: PMs work in subway, elevators, basements

**Requirements**:
```typescript
// Service Workers with Workbox
- Cache API responses (5 min default)
- Queue mutations when offline
- Background sync when back online
- Show offline indicator
- Optimistic updates (update UI immediately)

// Critical offline features:
✅ Time logging (most important!)
✅ Voice notes recording
✅ View projects/services
✅ Add quick notes
✅ View documents

⏸️ Requires online:
- AI features (follow-ups, analysis)
- QuickBooks sync
- NYC DOB sync
- File uploads >10MB
```

### Section 3.4: Audit Trail (Legal Requirement)
**Why**: Litigation export, compliance, debugging

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  entity_type VARCHAR(50), -- 'application', 'service', 'proposal'
  entity_id UUID,
  action VARCHAR(20), -- 'created', 'updated', 'deleted', 'viewed'
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_audit_company_date 
  ON audit_log(company_id, created_at DESC);
  
CREATE INDEX idx_audit_entity 
  ON audit_log(entity_type, entity_id);
```

**Retention**: Indefinite (never delete audit logs)

---

## Article IV: Core Features (MVP Scope)

### Section 4.1: Proposal Builder - Spreadsheet Style
**NOT** drag-and-drop (that was wrong!)

**Like JobTread - Table/Spreadsheet Format**:
```
Row | Job# | Service ↓              | Est Hrs | Rate  | Amount   | Actions
----+------+------------------------+---------+-------+----------+---------
  1 | 4216 | [Type to search...] ↓  |         |       |          | + Del
  2 | 4216 | Application Filing     |   3.5   | $225  |  $787.50 | ✎ Del
  3 | 4216 | Plan Review            |   8.0   | $225  | $1,800   | ✎ Del
  4 | 4217 | DOB Inspection         |   4.0   | $225  |  $900    | ✎ Del
----+------+------------------------+---------+-------+----------+---------
                                              TOTAL:  $3,487.50
```

**Features**:
- Type-ahead search (like Excel AutoComplete)
- Auto-fill hours/rate from service catalog
- Inline editing (click any cell)
- Live total updates
- Ctrl+D to duplicate row
- Tab to move between cells
- Group by job number (collapsible)
- Warning if price >30% off historical average

**Implementation**: TanStack Table v8 with editable cells

### Section 4.2: Property Hierarchy
**See all applications at one address**:

**Use Case**:
PM working on 689 5th Avenue → Needs to see:
- Active fire alarm job (#421639356)
- Completed sprinkler job (#421548877)
- Objection on elevator job (#422001234)

**UI**:
```
Property: 689 5th Avenue, Manhattan
Block: 1284 | Lot: 45 | BIN: 1089756

Applications (3):
┌─ Job #421639356 - Fire Alarm ─────────────────────┐
│ Status: Permit Issued 🟢                          │
│ PM: Sheri | Filed: 8/10/18 | Days: 527           │
│ Services: Filing ($788), Review ($1800), TR-1... │
└────────────────────────────────────────────────────┘

┌─ Job #421548877 - Sprinkler ──────────────────────┐
│ Status: Under Review 🟡                           │
│ PM: Natalia | Filed: 3/15/19 | Days: 23          │
└────────────────────────────────────────────────────┘

Summary: 3 apps | $12,450 billed | 2 active
```

**Navigation**:
- Click property address anywhere → Property view
- Search "689 5th" → Shows property + all jobs
- Client view → Properties → Applications

### Section 4.3: DOB NOW Chrome Extension
**THE stickiness feature**

**What It Does**:
1. PM clicks "Open in DOB NOW" in Ordino
2. DOB NOW opens with Ordino sidebar injected
3. Timer auto-starts (PM working on this job)
4. Quick actions available without leaving DOB

**Sidebar UI**:
```
┌─ Ordino Sidebar ────────────────┐
│ Project #7706                    │
│ 689 5th Ave - Fire Alarm        │
│                                  │
│ Timer: 00:15:23 ⏱️              │
│ [Pause] [Stop & Log]            │
│                                  │
│ QUICK LOG:                       │
│ [📞 Called DOB]    (15 min)     │
│ [📧 Emailed Client] (10 min)    │
│ [📋 Reviewed Plans] (30 min)    │
│ [⚠️ Objection]     (varies)     │
│                                  │
│ Add note:                        │
│ [____________________]           │
│ [Save Note]                      │
│                                  │
│ Recent activity:                 │
│ • 9:15 AM - Called (12m)        │
│ • 9:30 AM - Review (8m)         │
└──────────────────────────────────┘
```

**Technical**:
- Chrome Manifest V3 extension
- Content script injects on `*.nyc.gov/dobinquiry/*`
- Iframe sidebar communicates with Ordino API
- Context maintained via URL params + localStorage
- Auto-sync on close

### Section 4.4: AI Document Intelligence
**Upload PDF → AI extracts everything**

**Supported Documents**:
- DOB objection letters
- Violation notices
- Approval letters
- Plan sets (future)
- Correspondence

**AI Workflow**:
```
1. PM uploads objection letter PDF
   ↓
2. OCR if scanned (Tesseract/Google Vision)
   ↓
3. Claude analyzes:
   - Document type
   - Job numbers mentioned
   - Issues/objections raised
   - Deadlines
   - Required actions
   ↓
4. Auto-creates tasks:
   - "Submit structural calcs" (Due: 1/22)
   - "Revise egress plan" (Due: 1/22)
   - "Schedule architect call" (Due: 1/20)
   ↓
5. Suggests response (PM reviews/edits)
   ↓
6. Searches similar past objections
   "You resolved similar egress issue on
    Job #421548877 by submitting detail A-7"
```

**Value**: Save 20-30 min per objection × 50-100 objections/month = 16-50 hrs/month

### Section 4.5: Examiner Intelligence Database
**Capture tribal knowledge**

**Data Collection** (Passive, from Day 1):
```sql
CREATE TABLE examiner_interactions (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  application_id UUID REFERENCES dob_applications(id),
  examiner_name VARCHAR(100),
  interaction_type VARCHAR(50), -- 'call', 'email', 'meeting', 'review'
  outcome VARCHAR(20), -- 'approved', 'objection', 'pending'
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**PM Experience** (After 6-12 months data):
```
Assigned Examiner: John Smith

⚠️ EXAMINER PROFILE:
Success Rate: 67% (vs 82% average)
Avg Review Time: 23 days (vs 18 average)
Common Objections:
  • Requires wet stamps (not digital) - 73% of time
  • Strict on egress widths - 45% of time
  • Often requests additional calcs - 38% of time

💡 TIPS:
  • Call Tuesdays 10-11 AM (best response)
  • Send plans via email, follow up with call
  • Include extra details proactively

Past Projects with John: 12
  ✅ Approved: 8
  ❌ Objection: 4
```

**AI Pattern Detection**:
```python
# Backfill from existing notes
for note in all_project_notes:
    analysis = claude.analyze(note, """
        Extract:
        - Examiner name
        - Outcome (approved/objection/pending)
        - Any patterns or preferences mentioned
    """)
    
    if analysis.has_examiner:
        ExaminerInteraction.create(analysis)
```

### Section 4.6: Collapsible Requirements Table
**Visual progress per application**

**UI**:
```
▼ DOB Requirements Checklist (3 of 8 complete - 38%)

Item                    Status      Due Date   Assigned   Notes
────────────────────────────────────────────────────────────────
✅ Application Filed    Complete    -          Sheri      8/10
✅ Plans Approved       Complete    -          DOB        8/20
✅ Permit Issued        Complete    -          DOB        8/24
✅ TR-1 Inspection      Complete    -          Agency     9/15
⏳ Resolve Objection   URGENT 🔴   1/22/26    Sheri      NEW!
   └─ Missing: Structural calcs for beam
   └─ 🤖 AI sent reminder to architect 1/19
   [Request Plans] [Call Architect] [Mark Complete]
⏱️ TR-8 HVAC           Pending     2/15/26    Agency     -
⏱️ Final Sign-off      Pending     TBD        DOB        -
⏱️ CO Issuance         Pending     TBD        DOB        -

📊 Linked Services (Billing):
✅ Application Filing - $800 [BILLED]
✅ Plan Review - $200 [BILLED]
⏳ Inspections - $300 [In Progress - 2.5 hrs logged]
⏱️ Sign-off - $250 [Not Started]

Progress: 38% | Billed: $1,000 | Remaining: $550
```

**Features**:
- Visual progress bar
- Due dates with urgency colors (red <3 days)
- AI action tracking
- Linked to billing
- Expandable details
- One-click actions

---

## Article V: AI Integration Rules

### Section 5.1: Rate Limiting (CRITICAL - Infrastructure)
**Why**: Without limits, one bug = $30K/month bill

**Limits per Feature**:
```typescript
const RATE_LIMITS = {
  ai_followup: {
    perUser: 50,      // per day
    perCompany: 500,
    cooldown: 300     // 5 min
  },
  ai_document_analysis: {
    perUser: 20,
    perCompany: 200,
    cooldown: 60
  },
  voice_transcription: {
    perUser: 100,
    perCompany: 1000,
    cooldown: 10
  },
  ai_summarization: {
    perUser: 10,
    perCompany: 100,
    cooldown: 600     // 10 min
  }
};
```

**Implementation**: Redis (Upstash) for distributed rate limiting

**Cost Monitoring**:
```sql
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY,
  company_id UUID,
  user_id UUID,
  feature VARCHAR(50),
  tokens_used INTEGER,
  cost_usd DECIMAL(8,4),
  created_at TIMESTAMPTZ
);

-- Alert if daily cost > $50
-- Disable AI if > $100
```

**User-Facing**:
```
AI Usage Today:
━━━━━━━━━━━━━━━━━━━━━━ 23/50 Follow-ups
━━━━━━━━━━━━━━━━━━━━━━  8/20 Doc Analysis
━━━━━━━━━━━━━━━━━━━━━━ 47/100 Voice Notes

Resets: 11:00 PM EST (in 3 hours)
```

### Section 5.2: AI Quality Standards
```yaml
Accuracy: 90%+ contextually correct
Approval Rate: 80%+ accepted without edits
False Positives: <5% unnecessary suggestions
Response Time: <5 seconds for generation
Transparency: ALL AI content marked as AI-generated
```

### Section 5.3: AI Safety
**Hard Rules**:
- ❌ NO PII in prompts (SSN, credit cards, passwords)
- ✅ PM approval required before sending ANY communication
- ✅ All AI interactions logged (prompt + response + outcome)
- ✅ System must work 100% without AI (graceful degradation)
- ✅ AI can be disabled per-user if needed

---

## Article VI: QuickBooks Integration

### Section 6.1: Integration Scope
```yaml
Direction: Bidirectional

Ordino → QBO:
  - Projects → Customers (auto-create if new)
  - Services → Line Items
  - Completed work → Draft Invoices
  - Time logs → Time Activities (optional)

QBO → Ordino:
  - Payment Status (Paid, Partial, Overdue)
  - Invoice Numbers
  - Customer Balance
  - Last payment date

Sync Frequency: Real-time via webhooks (preferred)
Fallback: Every 15 minutes (polling)
```

### Section 6.2: Invoice Creation Workflow
```
PM marks service complete in Ordino
  ↓
Ordino creates draft invoice data
  ↓
Ordino calls QBO API → Creates DRAFT invoice
  ↓
Sai (accounting) reviews in QuickBooks
  ↓
Sai approves → Invoice sent to client
  ↓
QBO webhook → Ordino updates status to "Invoiced"
  ↓
Client pays
  ↓
QBO webhook → Ordino updates to "Paid"
```

**Percentage Billing Support**:
```typescript
// Bill 50% now, 50% on completion
service.billing_type = 'percentage';
service.percentage_milestones = [
  { name: 'Upon Approval', percent: 50, amount: 450 },
  { name: 'Upon Completion', percent: 50, amount: 450 }
];

// Auto-create invoice when milestone hit
if (service.status === 'approved') {
  createInvoice({
    lineItems: [{
      description: 'Fire Alarm Filing - 50% upon approval',
      amount: 450
    }]
  });
}
```

### Section 6.3: Authentication
```yaml
Method: OAuth 2.0 (standard Intuit flow)
Token Refresh: Automatic (refresh tokens valid 100 days)
Disconnect Handling: Graceful degradation (manual invoicing)
Multi-Company: Each Ordino company links to own QBO company
```

---

## Article VII: Performance Requirements

### Section 7.1: Response Time Targets
```yaml
Page Load (initial): <2 seconds (4G network)
Page Load (cached): <500ms
Page Load (offline): <100ms (from service worker)
API Response (p95): <500ms
Search: <300ms
Database Query: <100ms
Time Entry Save: <200ms
AI Response: <5 seconds
File Upload (<10MB): <3 seconds
```

### Section 7.2: Scalability Targets
```yaml
Concurrent Users: 100+ per company
Database Rows:
  - Applications: 1M+
  - Activities: 10M+
  - Audit Logs: Unlimited
File Storage: 1TB+ per company
API Requests: 10K+ per hour
Uptime: 99.5%+ (43.8 hours downtime/year max)
```

### Section 7.3: Mobile Performance
```yaml
Bundle Size: <500KB initial JS
Images: WebP format, lazy loading
Fonts: Subset, preload critical
Animations: 60fps, use CSS transforms
Battery: No polling (use WebSocket)
Network: Offline queue, background sync
```

---

## Article VIII: Security & Privacy

### Section 8.1: Data Encryption
```yaml
At Rest: AES-256 (PostgreSQL native)
In Transit: TLS 1.3 (HTTPS everywhere)
Sensitive Fields: Additional layer (Supabase Vault)
Backups: Encrypted, 30-day retention
```

### Section 8.2: Authentication
```yaml
Method: Supabase Auth (email + password)
Password: Minimum 12 characters, complexity required
MFA: Optional (encourage for admins)
Sessions: 1 hour access token, 30 day refresh
Logout: Complete token revocation
Failed Attempts: Lock after 5 failed (15 min)
```

### Section 8.3: Authorization (RBAC)
```yaml
Super Admin: Full access, all companies (Anthropic only)
Company Admin: Full access, single company
Manager: View all, edit own company
PM: View assigned projects, edit own work
Accounting: Billing, invoices, reports (no projects)
Client: View own projects only (future)
```

### Section 8.4: Compliance
```yaml
GDPR: Data export, right to deletion
CCPA: Data disclosure, opt-out
SOC 2 Type II: Target (Year 2)
HIPAA: Not applicable (no health data)
PCI DSS: Not applicable (no card storage - Stripe handles)
```

---

## Article IX: Development Workflow

### Section 9.1: Spec-Driven Development Process
```
1. constitution.md (this file) - Non-negotiable principles
2. spec.md - WHAT & WHY (product perspective, no tech)
3. plan.md - HOW (technical perspective, architecture)
4. tasks.md - DO (implementation breakdown)
5. implement - Build, test, review, deploy
```

**Separation of Concerns** (CRITICAL):
```
spec.md:
  ✅ User stories, acceptance criteria
  ✅ Business rules, success metrics
  ✅ "What should this do and why?"
  ❌ NO technology choices
  ❌ NO architecture details
  ❌ NO database schemas

plan.md:
  ✅ Tech stack, database schema
  ✅ API endpoints, architecture
  ✅ Component structure
  ✅ "How do we build this?"
  ❌ NO business justifications
  ❌ NO user stories
```

### Section 9.2: Git Workflow
```yaml
Branches:
  - main: Production (protected)
  - develop: Integration
  - feature/SPEC-001-*: Features
  - fix/*: Bug fixes
  - hotfix/*: Production emergencies

Naming: feature/SPEC-001-dob-chrome-extension
Commits: [TASK-042] Add sidebar injection logic
PRs: Require review, passing tests, constitution compliance

Merge Strategy:
  - feature/* → develop: Squash merge
  - develop → main: Merge commit (preserves history)
  - hotfix/* → main: Fast-forward
```

### Section 9.3: Code Quality Gates
```yaml
TypeScript: Strict mode, no implicit any
Testing:
  - Unit: 80%+ coverage on business logic
  - Integration: All API endpoints
  - E2E: Critical user journeys
  - Visual: Chromatic for UI components

Linting: ESLint + Prettier (auto-fix on save)
Type Safety: Zod for runtime validation
Build: Must compile without errors/warnings
Bundle: <500KB, tree-shaking verified
```

---

## Article X: Team & Work Model

### Section 10.1: Remote-First Design
**Current Reality**: All NYC team members work remotely

**Implications**:
- ✅ Clock in from anywhere (no location tracking)
- ✅ Mobile-first (work from phone)
- ✅ Async communication (Slack, email)
- ✅ Cloud-based everything
- ❌ NO office location tracking (for now)
- ❌ NO physical file systems
- ❌ NO in-office requirements

**Future-Proofing** (When expanding to other markets):
```sql
-- Offices table (optional, for future)
CREATE TABLE offices (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name VARCHAR(100), -- "Tampa Office", "Nassau Office"
  municipality VARCHAR(100),
  is_remote BOOLEAN DEFAULT true
);

-- Users can optionally be assigned to office
ALTER TABLE users ADD COLUMN office_id UUID REFERENCES offices(id) NULL;
```

**Settings**:
```yaml
Work Model Options:
  - Fully Remote (Default for GLE)
  - Hybrid (future)
  - Office-Based (future for other markets)
```

---

## Article XI: Competitive Strategy

### Section 11.1: Green Lite Technology - Do NOT Partner
**Background**: Attempted third-party plan review in NYC (where it doesn't exist). Attorney sent cease letter. They're hiring NYC expediters while claiming to be "different."

**Decision**: FUCK 'EM. Build better AI solution.

**What NOT To Do**:
- ❌ Integrate with Green Lite
- ❌ Partner with them
- ❌ Reference them in marketing
- ❌ Build "third-party review" features (legal gray area)

**What TO Do Instead**:
Build **AI Pre-Filing Check** (Internal Tool):
```
PM uploads architectural plans (PDF)
  ↓
AI extracts:
  - Building dimensions
  - Use group, construction type
  - Egress paths, fire ratings
  - Structural elements
  ↓
AI checks against NYC Building Code:
  - Egress width (min 36")
  - Fire-rated assemblies
  - ADA accessibility
  - Zoning (FAR, height)
  ↓
AI flags potential issues:
  ⚠️ "Egress width 34" (required 36" min) - Will object"
  ⚠️ "No fire door shown between lobby/cellar"
  ⚠️ "Accessible bathroom required but not shown"
  ↓
PM coordinates fixes with architect BEFORE filing
  ↓
Result: Fewer objections, faster approvals
```

**Marketing**:
- ✅ "AI Plan Review - Catch Issues Before DOB Does"
- ✅ "Smart Pre-Filing Check"
- ❌ NOT "Third-party plan review" (that's Green Lite's scam)

**Legal**: Totally fine (internal tool, not claiming to be official reviewer)

---

## Article XII: Success Metrics

### Section 12.1: North Star Metric
**90%+ of billable time logged within 24 hours**

**Why This Matters**:
- Current: ~70% time logged = 30% revenue leakage
- Target: 90%+ = $200K+ recovered annually (for GLE)
- Proves stickiness (PMs using it daily)

### Section 12.2: User Adoption Metrics
```yaml
Daily Active PMs: 90%+ of total PMs
Average Logins per PM: 5+ per day
Mobile Usage: 60%+ of time entries
Login Streak: Average 20+ consecutive days
Feature Engagement:
  - DOB NOW Extension: 80%+ usage
  - Voice Notes: 50%+ usage
  - AI Follow-ups: 70%+ approved
```

### Section 12.3: Efficiency Metrics
```yaml
Time Entry Speed: <30 seconds (vs 2-5 min current)
Follow-up Time: 70% reduction (AI handles)
Client Reporting: 90% reduction (30 min → 3 min)
Proposal Creation: 50% faster (spreadsheet vs manual)
DOB Status Checks: 100% automated (vs daily manual)
```

### Section 12.4: Business Impact Metrics
```yaml
Revenue Capture: 95%+ (vs 85% current)
Billing Accuracy: ±15% of actual (vs ±30% current)
Client Satisfaction: 95%+ (proactive updates)
PM Retention: 95%+ (tool they love)
Client Churn: <10% annually
```

### Section 12.5: Technical Health Metrics
```yaml
Uptime: 99.5%+
API Response Time: <500ms (p95)
Error Rate: <0.1%
Security Incidents: 0
Data Loss Incidents: 0
Failed Deployments: <5%
```

---

## Article XIII: Governance

### Section 13.1: Amendment Process
1. Propose amendment with justification
2. Technical + product owner review
3. Impact analysis (code, specs, timelines)
4. Migration plan (if breaking change)
5. Document approval + effective date
6. Update all affected specs/plans/tasks

### Section 13.2: Precedence Hierarchy
**Constitution > Plan > Spec > Tasks > Code**

In conflicts:
- Constitution ALWAYS wins
- Code violating constitution MUST be rejected
- PRs require constitutional compliance verification

### Section 13.3: Review Cycle
```yaml
Weekly: Sprint planning, task review
Monthly: Feature prioritization, roadmap
Quarterly: Constitution relevance review
Annually: Major revision (if needed)
Emergency: Critical issues (security, legal)
```

---

## Signatures

**Technical Owner**: Manny Russell  
**Date**: February 3, 2026  
**Version**: 3.0.0  
**Status**: Active - Ready for Clean Rebuild  
**Build Tool**: Lovable + Supabase + Vercel  
**Target Launch**: Week 36 (MVP)  
**Budget**: $94,000  

---

**FINAL NOTES**:

This constitution incorporates:
- ✅ All learnings from $300K Laravel investment
- ✅ Corrections (spreadsheet proposals, property hierarchy, etc.)
- ✅ New features (DOB extension, AI intelligence, examiner DB)
- ✅ Reality checks (remote team, rate limiting, Green Lite strategy)
- ✅ Clean rebuild approach (React + Supabase, no legacy)

**Next Steps**:
1. Create spec.md (WHAT & WHY - product perspective)
2. Create plan.md (HOW - technical details)
3. Create tasks.md (DO - implementation breakdown)
4. Build with Lovable

**This is the definitive source of truth for Ordino development.**
