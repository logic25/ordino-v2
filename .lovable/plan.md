# Ordino Billing System - Implementation Plan - While we wait for QBO integration use mock data

## Overview

Build a full billing system enhancing the existing `/invoices` placeholder page. The original spec (Epic 8) focused on QBO as the primary workspace; the new spec correctly moves invoice management INTO Ordino with QBO as a sync target.

**Strategy**: Build the internal invoice system first (works standalone), then layer QuickBooks integration on top. This way billing is usable immediately while QBO credentials are being set up.

---

## Implementation Phases

### Phase A: Database Schema (Foundation)

Create the following tables with RLS policies using `company_id` isolation (matching existing patterns):

`**invoices**` - Core invoice records

- id, company_id, invoice_number, project_id, client_id, billing_request_id
- line_items (JSONB), subtotal, retainer_applied, fees (JSONB), total_due
- status: draft | ready_to_send | needs_review | sent | overdue | paid
- review_reason, payment_terms, due_date
- billed_to_contact_id (references client_contacts)
- created_by (references profiles), sent_at, paid_at, payment_amount, payment_method
- qbo_invoice_id, qbo_synced_at, qbo_payment_status
- gmail_message_id, special_instructions
- created_at, updated_at

`**billing_requests**` - PM requests to billing

- id, company_id, project_id, created_by, services (JSONB)
- total_amount, status (pending | invoiced | cancelled)
- billed_to_contact_id, invoice_id, created_at

`**client_billing_rules**` - Per-client special procedures

- id, company_id, client_id, vendor_id, property_id
- require_waiver, require_pay_app, wire_fee, cc_markup
- special_portal_required, portal_url, special_instructions

`**invoice_activity_log**` - Audit trail

- id, company_id, invoice_id, action, details, performed_by, created_at

`**invoice_follow_ups**` - Collections tracking

- id, company_id, invoice_id, follow_up_date, contact_method, notes, contacted_by

`**qbo_connections**` - QuickBooks OAuth tokens

- id, company_id, access_token, refresh_token, realm_id, company_name
- expires_at, connected_at, last_sync_at

**Alter existing tables:**

- `projects`: add qbo_customer_id, retainer_balance, retainer_amount, retainer_received_date

**RLS**: All tables use `is_company_member(company_id)` for SELECT, `is_admin_or_manager(company_id)` for mutations (matching existing patterns). Accounting role gets access via `has_role(company_id, 'accounting')`.

**Indexes**: status, client_id, project_id, due_date, qbo_payment_status on invoices.

---

### Phase B: Invoice List UI (Replace Placeholder)

**Files to create/modify:**

- `src/hooks/useInvoices.ts` - CRUD hooks for invoices
- `src/components/invoices/InvoiceSummaryCards.tsx` - 5 clickable cards (Draft, Sent, Overdue, Paid, Needs Review) with live counts from DB
- `src/components/invoices/InvoiceTable.tsx` - Table with columns: Select, Invoice #, Client, Project, Amount, Status, Date, Actions
- `src/components/invoices/InvoiceFilterTabs.tsx` - Tab navigation: All | Ready to Send | Needs Review | Sent | Overdue | Paid | Collections
- `src/components/invoices/InvoiceStatusBadge.tsx` - Color-coded status badges
- `src/pages/Invoices.tsx` - Enhanced with real components replacing static content

**Behavior:**

- Clicking a summary card filters the table to that status
- Tab navigation provides same filtering
- Search by invoice number, client name, project name
- Bulk selection with "Approve and Send" / "Export" / "Delete Drafts" actions

---

### Phase C: Create Invoice Dialog

**Files to create:**

- `src/components/invoices/CreateInvoiceDialog.tsx` - Modal form with:
  - Project selector (auto-fills client)
  - Bill-to contact dropdown
  - Line items table (add/remove/edit rows: description, qty, rate, amount)
  - Retainer check button (queries project retainer balance)
  - Subtotal / retainer applied / fees / total calculation
  - Payment terms dropdown (Net 30, Net 60, Due on Receipt, etc.)
  - Save Draft / Preview / Send actions
- `src/components/invoices/LineItemsEditor.tsx` - Editable line items with auto-calculation

**Auto-numbering**: Generate invoice numbers as `INV-{sequential}` using a DB function.

---

### Phase D: Invoice Detail Sheet

**Files to create:**

- `src/components/invoices/InvoiceDetailSheet.tsx` - Slide-over sheet (matching EmailDetailSheet pattern) showing:
  - Invoice header (number, status badge, edit/send buttons)
  - Project info section
  - Bill-to contact details
  - Line items read-only table
  - Retainer/fees/total breakdown
  - Payment terms and due date
  - Special procedures section (if client has billing rules)
  - Activity log timeline
- `src/components/invoices/ActivityLog.tsx` - Timeline of invoice events
- `src/components/invoices/SpecialProcedures.tsx` - Checklist for client-specific requirements

**Edit mode**: Toggle to editable fields for line items, contact, terms.

---

### Phase E: Send Invoice Flow

**Files to create:**

- `src/components/invoices/SendInvoiceModal.tsx` - Confirmation dialog showing:
  - Recipient email, optional CC
  - Amount summary
  - What will happen (send email, update status)
  - Processing states with spinners
- `supabase/functions/send-invoice/index.ts` - Edge function that:
  - Generates invoice email body (HTML template)
  - Sends via existing Gmail integration (reuses gmail-send function)
  - Updates invoice status to 'sent'
  - Logs activity

**Note**: PDF generation deferred to Phase G (QBO integration). Initial send uses HTML email with invoice details inline.

---

### Phase F: Collections Tab

**Files to create:**

- `src/components/invoices/CollectionsView.tsx` - Grouped by urgency:
  - Critical (90+ days): red indicators, write-off/demand letter options
  - Urgent (60-90 days): orange
  - Attention (30-60 days): yellow
- `src/components/invoices/CollectionActions.tsx` - Send Reminder (opens compose email), Demand Letter, Write Off
- `src/hooks/useCollections.ts` - Queries overdue invoices with days calculation

**Auto-overdue**: DB function or edge function that runs daily to mark invoices past due_date as 'overdue'.

---

### Phase G: QuickBooks Integration (Requires API Credentials)

**Prerequisite**: QuickBooks Developer account with OAuth 2.0 credentials (Client ID, Client Secret).

**Files to create:**

- `supabase/functions/qbo-auth/index.ts` - OAuth flow (get auth URL, exchange code, refresh tokens)
- `supabase/functions/qbo-sync/index.ts` - Sync customers, push invoices, check payment status
- `src/components/invoices/QBOConnectionStatus.tsx` - Connection widget (connected/disconnected state)
- `src/hooks/useQBOConnection.ts` - Connection status and actions

**Sync operations:**

- Customer sync: match QBO customers to Ordino clients
- Invoice push: create DRAFT in QBO when invoice created in Ordino
- Payment status pull: check paid/partial status from QBO
- Retainer balance: query QBO for customer credit balances

---

### Phase H: Billing Request Flow (PM Side)

**Files to modify:**

- Add "Send to Billing" button in project/service completion flow
- Creates `billing_request` record
- Auto-creates invoice with line items from completed services
- Routes to "Ready to Send" or "Needs Review" based on client billing rules

---

### Phase I: Settings

**Files to create:**

- Add Invoice Settings section to existing `/settings` page:
  - Collections timeline (reminder days)
  - Default payment terms
  - Client billing rules management (CRUD)
  - QBO connection management

---

## Technical Details

### Sequence for invoice creation

```text
PM completes service
  --> billing_request created (status: pending)
  --> auto-create invoice function runs
    --> checks client_billing_rules for special requirements
    --> queries project retainer balance
    --> calculates line items, applies retainer
    --> if rules require review --> status: needs_review
    --> else --> status: ready_to_send
  --> Sai sees invoice in appropriate tab
  --> Sai reviews, clicks Send
    --> email sent via Gmail
    --> QBO draft created (if connected)
    --> status: sent
  --> payment received
    --> QBO webhook or manual mark
    --> status: paid
```

### Component patterns

- Follow existing patterns: hooks in `src/hooks/`, components in `src/components/invoices/`
- Use Sheet for detail view (like EmailDetailSheet)
- Use Dialog for create/send modals
- Use existing Table components
- Use existing Badge for status indicators

### Dependencies

- No new npm packages needed for Phases A-F
- QuickBooks OAuth handled via edge functions (Phase G)

---

## Estimated Scope

- **Phases A-D**: Core billing (DB + list + create + detail) -- buildable now
- **Phase E**: Send flow -- buildable now (uses existing Gmail)
- **Phase F**: Collections -- buildable now
- **Phase G**: QBO integration -- requires API credentials from Intuit
- **Phases H-I**: PM flow + settings -- buildable after core is done

Recommend starting with **Phases A through D** as one implementation block.