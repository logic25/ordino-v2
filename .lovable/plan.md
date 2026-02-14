# Ordino — Development Roadmap

## Current Status (Feb 2026)
Core Billing and Email modules are functional with mock data. Below is the prioritized roadmap.

---

## Phase L: Server-Side PDF Engine
**Status:** 🔴 Not Started | **Priority:** High | **Blocks:** ClaimFlow v2, Invoice emails

### Why
Current client-side PDF (jsPDF in edge function + @react-pdf/renderer on client) produces low-quality output. Need sharp, branded invoices with company logo, clean typography, and proper layout.

### Scope
- Build a server-side PDF rendering edge function using a proper templating approach
- Support company branding (logo from `company-assets` bucket, colors, header/footer text)
- Generate invoice PDFs, demand letters, and legal packages from a single engine
- Store generated PDFs in storage for email attachment and download

### Dependencies
- Company branding settings (✅ done)
- Storage buckets (✅ done)

---

## Phase G: QuickBooks Online Integration
**Status:** 🔴 Not Started | **Priority:** High

### Scope
- Replace mock QBO connection with live OAuth2 flow
- Sync invoices, payments, and credit memos bidirectionally
- Map retainer deposits to QBO credit memos

---

## Phase K: AI Task Extraction
**Status:** 🔴 Not Started | **Priority:** Medium

### Scope
- Extract follow-up tasks from email threads and invoice notes
- Human-in-the-loop approval before task creation
- Uses Gemini 3 Flash (already provisioned)

---

## Billing UX Fixes
**Status:** 🟡 Roadmapped | **Priority:** Medium

### Context-Aware Bulk Actions
The bulk action bar currently shows "Approve & Send" and "Delete" regardless of selected invoice statuses. Fix:
- **Draft/Ready to Send selected** → Show "Approve & Send"
- **Sent/Overdue selected** → Show "Send Reminder", "Mark Paid"
- **Mixed selection** → Show only universally applicable actions (Delete)
- Remove radio buttons → use checkboxes (radio implies single-select)

### ACH Authorization Template
- Add editable ACH Authorization Agreement template to Invoice Settings
- Merge fields: `{{company_name}}`, `{{invoice_number}}`, `{{total_amount}}`, `{{payment_schedule}}`, `{{effective_date}}`
- Uses same collapsible card pattern as demand letter template
- Falls back to hardcoded default if no custom template saved

---

## ClaimFlow v2: Resolution & Enforcement
**Status:** 🟡 Roadmapped | **Priority:** Medium | **Blocked by:** Phase L, Proposal E-Signatures

### Legal Package Quality
- Replace jsPDF output with Phase L PDF engine for sharp, professional documents
- Include actual signed contract (requires proposal e-signature system)
- Include properly formatted invoice copy with company branding
- Bundle follow-up history, payment promises, and activity log

### Resolution Tracking
- Add outcome capture to ClaimFlow referrals: won, settled, dismissed
- Record recovered amount vs. original amount owed
- Upload court documents / judgment documents
- Track judgment details (case number, court, date)

### Enforcement Workflow
After winning a judgment:
- Track enforcement steps (filing with sheriff, property liens, garnishment)
- Record enforcement costs and recovered amounts
- Timeline view of legal proceedings
- Auto-update invoice status based on resolution (paid via judgment, written off, etc.)

### Schema Changes Needed
```sql
ALTER TABLE claimflow_referrals ADD COLUMN resolution_type text; -- won, settled, dismissed, withdrawn
ALTER TABLE claimflow_referrals ADD COLUMN recovered_amount numeric DEFAULT 0;
ALTER TABLE claimflow_referrals ADD COLUMN judgment_amount numeric;
ALTER TABLE claimflow_referrals ADD COLUMN case_number text;
ALTER TABLE claimflow_referrals ADD COLUMN court_name text;
ALTER TABLE claimflow_referrals ADD COLUMN resolved_at timestamptz;
ALTER TABLE claimflow_referrals ADD COLUMN enforcement_status text; -- pending, filed, collecting, completed
```

---

## Proposal E-Signatures
**Status:** 🟡 Roadmapped | **Priority:** Medium | **Blocks:** ClaimFlow v2

### Scope
- Digital signature capture on proposals (client-facing link)
- Store signed PDF copy in storage
- Mark proposal as "signed" with timestamp and signer info
- Signed contract becomes available for ClaimFlow legal package

---

## Document Storage & S3 Integration
**Status:** 🟡 Roadmapped | **Priority:** Medium

### Scope
- Support external S3/R2 buckets for large file volumes (1GB cloud limit)
- Migrate legacy Uploadcare files
- File versioning for PAA resubmissions
- Preserve original file extensions and project mappings

---

## Change Orders
**Status:** 🟡 Roadmapped | **Priority:** Medium

### Scope
- Change orders as additional scoped work on existing projects
- Can draw down from existing retainer or generate new invoices
- Require client approval (ties into e-signature system)
- Track original contract value vs. change order additions
