
# Billing System Enhancement: Invoice PDF, Payment Options, and Settings Overhaul

## What This Covers

This is a significant expansion of the billing system to bridge the gap between what's currently built (basic invoice CRUD, collections, demand letters) and the full Ordino Billing spec. The work breaks into three main areas: (1) Invoice PDF preview/generation, (2) expanded Invoice & Billing Settings, and (3) wiring it all together.

---

## Current State

**What exists today:**
- Invoice list with filter tabs, summary cards, detail sheet, create dialog
- Send Invoice modal (mock PDF + Gmail + QBO sync steps)
- Collections view grouped by urgency (30/60/90+ days)
- Demand letter template editor in Settings with merge fields
- Basic collections timeline config (reminder days)
- Client billing rules display (hardcoded mock data, no CRUD)
- Mock QBO connection widget
- Follow-up notes and activity log per invoice

**What's missing (and this plan addresses):**
- No actual invoice PDF preview or generation
- "Preview PDF" and "Download" buttons in detail sheet do nothing
- Settings sections are incomplete -- no email templates, no payment method config, no Stripe/Zelle/Wire info, no QBO sync settings
- Client billing rules are static mock data with no add/edit/delete
- Collections settings (reminder schedule) don't persist to the database
- No payment instructions on invoices

---

## Implementation Plan

### 1. Invoice PDF Preview and Generation

Install `@react-pdf/renderer` to generate real invoice PDFs that can be previewed in-browser and downloaded.

**New files:**
- `src/components/invoices/InvoicePDF.tsx` -- React-PDF document component with the full invoice layout:
  - Company header (logo area, name, address, phone, fax, email)
  - Invoice number, date, due date
  - Bill-to section with contact details
  - Project reference
  - Line items table (Description, Qty, Rate, Amount)
  - Subtotal, retainer applied, fees, total due
  - Payment instructions section (check, wire, Zelle, credit card -- pulled from company settings)
  - Footer with contact info
- `src/components/invoices/InvoicePDFPreview.tsx` -- Dialog that renders the PDF in an iframe using `pdf().toBlob()` and `URL.createObjectURL`

**Modified files:**
- `InvoiceDetailSheet.tsx` -- Add "Preview PDF" and "Download PDF" buttons that use the new components
- `SendInvoiceModal.tsx` -- Replace the mock "Generating PDF..." step with actual PDF generation, attach to the email payload

### 2. Company Payment Info (Settings)

Add a new "Payment Methods" card to Invoice Settings where the admin configures how clients can pay. This data gets embedded into every invoice PDF and email.

**New settings fields** (stored in `companies.settings` JSON):
- `payment_check_address` -- Mailing address for checks
- `payment_wire_bank_name`, `payment_wire_routing`, `payment_wire_account` -- Wire transfer details
- `payment_zelle_id` -- Zelle email/phone
- `payment_cc_enabled` -- Whether credit card is accepted
- `payment_cc_url` -- Stripe payment link (or custom URL)
- `company_address`, `company_phone`, `company_fax`, `company_email` -- For the PDF header

**Modified files:**
- `src/hooks/useCompanySettings.ts` -- Extend `CompanySettings` interface with payment fields
- `src/components/settings/InvoiceSettings.tsx` -- Add three new cards:
  1. **Company Info** -- Address, phone, fax, email (used in PDF header)
  2. **Payment Methods** -- Check address, wire details, Zelle, CC toggle + URL
  3. **Email Templates** -- Customize the invoice email subject and body (with merge fields, similar to demand letter)

### 3. Collections Settings Persistence

Currently, reminder days and auto-reminders are local state only. Wire them to `companies.settings`:

**New settings fields:**
- `collections_first_reminder_days` (default 30)
- `collections_second_reminder_days` (default 60)
- `collections_demand_letter_days` (default 90)
- `collections_auto_reminders` (boolean)
- `collections_early_payment_discount` (boolean + percentage)

**Modified files:**
- `src/hooks/useCompanySettings.ts` -- Add fields to interface
- `src/components/settings/InvoiceSettings.tsx` -- Save button actually persists to DB

### 4. Client Billing Rules CRUD

Replace the hardcoded mock rules with real database-backed rules.

**Database changes:**
- New table `client_billing_rules` (if not already created):
  - `id`, `company_id`, `client_id` (FK to clients)
  - `vendor_id`, `property_id` (text)
  - `require_waiver`, `require_pay_app` (boolean)
  - `wire_fee` (decimal), `cc_markup` (decimal)
  - `special_portal_required` (boolean), `portal_url` (text)
  - `special_instructions` (text)
  - `lien_release_required` (boolean), `lien_release_threshold` (decimal)
  - `special_cc_contacts` (text array -- CC these emails on invoices)
  - RLS: `is_company_member(company_id)` for read, `is_admin_or_manager(company_id)` for write

**New files:**
- `src/hooks/useClientBillingRules.ts` -- CRUD hooks for the rules table

**Modified files:**
- `src/components/settings/InvoiceSettings.tsx` -- Replace mock data with real queries; Add Rule dialog with client selector and all fields; Edit/Delete functionality
- `src/components/invoices/InvoiceDetailSheet.tsx` -- Show active billing rules for the invoice's client
- `src/components/invoices/CreateInvoiceDialog.tsx` -- When client is selected, check for rules and auto-flag "needs_review" if special procedures exist

### 5. Invoice Email Template

Add a customizable email template (similar to demand letter) for the standard invoice email.

**New settings fields:**
- `invoice_email_subject_template` -- e.g., `"Invoice #{{invoice_number}} - Project #{{project_number}} ({{project_name}})"`
- `invoice_email_body_template` -- HTML or plain text with merge fields

**Modified files:**
- `src/components/settings/InvoiceSettings.tsx` -- New "Email Templates" card with subject + body editors and merge field badges
- `SendInvoiceModal.tsx` -- Use the template to compose the email

### 6. QBO Settings Section Enhancement

Expand the QuickBooks section in Settings beyond the basic connected/disconnected display.

**Modified files:**
- `src/components/settings/InvoiceSettings.tsx` -- Add:
  - Sync frequency selector (hourly / every 6 hours / daily / manual only)
  - Last sync timestamp
  - Recent sync log preview (mock data for now, real when QBO goes live)
  - "Sync Now" button (uses existing mock layer)

---

## Technical Details

### PDF Generation Architecture

```text
InvoicePDF (React-PDF Document)
  |
  +-- Uses company settings for header + payment info
  +-- Uses invoice data for line items, totals
  +-- Uses client/contact data for bill-to
  |
InvoicePDFPreview (Dialog)
  |
  +-- Calls pdf(<InvoicePDF />).toBlob()
  +-- Renders in <iframe> via URL.createObjectURL
  +-- Download button creates <a download> link
  |
InvoiceDetailSheet
  +-- "Preview PDF" -> opens InvoicePDFPreview
  +-- "Download" -> generates blob + triggers download
  |
SendInvoiceModal
  +-- Generates PDF blob during "Generating PDF" step
  +-- Converts to base64 for email attachment
```

### Settings Data Flow

```text
companies.settings (JSONB)
  |
  +-- service_catalog[]
  +-- default_terms
  +-- company_types[]
  +-- review_categories[]
  +-- demand_letter_template
  +-- NEW: payment_check_address
  +-- NEW: payment_wire_*
  +-- NEW: payment_zelle_id
  +-- NEW: payment_cc_enabled / payment_cc_url
  +-- NEW: company_address / phone / fax / email
  +-- NEW: collections_* settings
  +-- NEW: invoice_email_subject_template
  +-- NEW: invoice_email_body_template
```

### New Dependency

- `@react-pdf/renderer` -- For generating real invoice PDFs client-side

### Database Migration

One migration for the `client_billing_rules` table with RLS policies matching the existing pattern (`is_company_member` for SELECT, `is_admin_or_manager` for INSERT/UPDATE/DELETE).

---

## Implementation Order

1. **Company Settings expansion** -- Add payment info, collections persistence, email template fields to settings
2. **Client Billing Rules table + CRUD** -- Database migration + hooks + Settings UI
3. **Invoice PDF component** -- Build the PDF layout using company settings data
4. **PDF Preview + Download** -- Wire into InvoiceDetailSheet
5. **Email template integration** -- Use template in SendInvoiceModal
6. **QBO Settings enhancement** -- Expand sync config UI

---

## Roadmap Update

After this implementation, the plan.md will be updated to mark Phase I (Settings) and Phase J (Client Billing Rules) as complete, and Phase G (live QBO) remains the next major milestone requiring external API credentials.
