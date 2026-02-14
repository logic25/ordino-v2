

# Overlap Analysis: Existing Features vs. Planned Enhancements

This document identifies every area where the planned AI Collections upgrade overlaps with what already exists, so we avoid rebuilding or duplicating functionality.

---

## 1. Follow-Up Notes vs. Promise-to-Pay

**What exists:**
- `invoice_follow_ups` table with `contact_method`, `notes`, `contacted_by`, `follow_up_date`
- Follow-up note capture in both `CollectionsView.tsx` (quick note dialog) and `InvoiceDetailSheet.tsx` (inline add note form)
- Contact methods: phone_call, left_message, reminder_email, note

**What's planned:**
- `payment_promises` table with `promised_amount`, `promised_date`, `payment_method`, `status` (pending/kept/broken)

**The overlap:**
A promise-to-pay logged during a phone call is currently just a follow-up note with free-text like "Spoke with John, check coming Friday." The new system adds structured fields (amount, date, method, status tracking). These are NOT the same thing -- promises are a subset of follow-ups with enforceable data.

**Resolution:**
- Keep `invoice_follow_ups` as-is for general notes
- Add `payment_promises` as a new table that links to follow-ups when the source is a phone call or note
- In the UI, the "Add Note" form gets an optional "Log Promise" toggle that reveals the structured fields (amount, date, method). When saved, it creates BOTH a follow-up note AND a promise record
- No duplication -- one interaction, two records when needed

---

## 2. Reminder Email (Collections) vs. AI Message Composer

**What exists:**
- "Send Reminder" button on each collection card and in InvoiceDetailSheet
- Opens a dialog with invoice summary and an optional free-text note
- Logs to `invoice_follow_ups` as `reminder_email`
- Currently a mock send (setTimeout, no actual email)

**What's planned:**
- AI Message Composer that generates contextual emails with tone/urgency controls
- "Use AI Message" button on worklist cards

**The overlap:**
Both produce reminder emails. The AI composer is a smarter version of the existing reminder dialog.

**Resolution:**
- Enhance the existing reminder dialog rather than creating a separate composer
- Add a "Generate with AI" button inside the current reminder dialog
- When clicked, it calls the edge function and populates the note/message area with AI-generated content
- User can edit before sending
- The dialog keeps its current simple mode (manual note) but gains an AI assist option
- No new separate "AI Composer" component needed

---

## 3. Demand Letter (Existing) vs. AI Collections Escalation

**What exists:**
- Full demand letter workflow: template in Settings with merge fields, preview/edit dialog, send action
- Template stored in `companies.settings.demand_letter_template`
- Merge fields: client_name, invoice_number, amount_due, days_overdue, etc.
- Available on critical/urgent invoices in Collections and in InvoiceDetailSheet

**What's planned:**
- AI-recommended escalation actions in the worklist
- AI message generation for urgent follow-ups

**The overlap:**
The demand letter is already the escalation path. AI recommendations should suggest USING the existing demand letter flow, not create a parallel one.

**Resolution:**
- AI worklist tasks of type "escalation" should link to the existing demand letter dialog
- AI can suggest modifications to the demand letter text (via the generate-collection-message edge function) but uses the same template system
- No new escalation UI needed

---

## 4. Collections View Grouping vs. AI Worklist

**What exists:**
- `CollectionsView.tsx`: Groups overdue invoices by urgency (30-60, 60-90, 90+ days)
- Summary banner with total count and amount
- Per-card actions: Add Note, Send Reminder, Demand Letter, Write Off
- Quick note dialog with contact method selector

**What's planned:**
- AI Worklist mode as a toggle on the same view
- Cards sorted by AI priority instead of age

**The overlap:**
Both show the same invoices with the same actions. The worklist is just a different sort order with AI annotations.

**Resolution:**
- Add a view toggle (Urgency Groups / AI Priority) at the top of CollectionsView
- In AI Priority mode, reuse the same card component but add: risk score badge, AI recommended action text, suggested message preview
- Same action buttons (Note, Reminder, Demand, Write Off) plus new ones (Log Promise, Use AI Message)
- One component, two sort modes -- not two separate views

---

## 5. Invoice Activity Log vs. Automation Execution Log

**What exists:**
- `invoice_activity_log` table with `action`, `details`, `performed_by`
- Combined timeline in InvoiceDetailSheet merging synthetic entries (created, sent, paid) with explicit log entries
- Method labels: reminder_email, demand_letter, write_off, phone_call, etc.

**What's planned:**
- `automation_executions` table logging rule triggers and actions

**The overlap:**
Automation executions are just another type of activity. When an automation rule sends a reminder, that should appear in the same activity log.

**Resolution:**
- Automation executions get their own table for rule-specific tracking (which rule, success/failure)
- BUT each execution also writes to `invoice_activity_log` so the invoice timeline stays complete
- Add new method labels: `auto_reminder`, `auto_sms`, `auto_escalation`, `ai_risk_update`
- No separate activity view needed

---

## 6. Collections Settings vs. Automation Rules

**What exists (in InvoiceSettings.tsx):**
- Collections timeline: First reminder days, Second reminder days, Demand letter days
- Auto-reminders toggle
- Early payment discount toggle + percentage
- All stored in `companies.settings` JSONB

**What's planned:**
- `automation_rules` table with trigger conditions and actions
- Rule builder UI in Settings

**The overlap:**
The current collections settings ARE a simple version of automation rules. "Send reminder at 30 days" is just a rule with trigger `days_overdue = 30` and action `send_email`.

**Resolution:**
- Phase 4 (Automation Rules) replaces the current simple collections timeline settings with the full rule builder
- During Phases 1-3, the existing settings continue to work as-is
- When Phase 4 lands, migrate the existing settings values into automation_rules records and remove the old fields
- The "Collections Timeline" card in Settings evolves into the "Automation Rules" card
- Don't build both systems simultaneously

---

## 7. Write-Off vs. Dispute Resolution

**What exists:**
- Write-off action on critical invoices: marks status as "paid" and logs it
- Available in both CollectionsView and InvoiceDetailSheet

**What's planned:**
- Dispute management with resolution actions including "Issue Credit" and "Adjust Invoice Amount"

**The overlap:**
A write-off is effectively a dispute resolution where the company absorbs the loss. A credit adjustment is a partial write-off.

**Resolution:**
- Keep write-off as a standalone action (it's a business decision, not a dispute)
- Dispute resolution actions (adjust amount, issue credit) are separate from write-off
- Add a `write_off_amount` field to invoices so partial write-offs are tracked
- When a dispute is resolved with "Issue Credit," it creates a credit memo, not a write-off
- Different workflows, but both update the invoice and log to activity

---

## 8. Client Info Card vs. Client Payment Analytics

**What exists (InvoiceDetailSheet):**
- Client Info section: name, phone (clickable), email (clickable), address
- Billing contact section: name, title, office phone, mobile, email

**What's planned:**
- `client_payment_analytics`: avg_days_to_payment, reliability_score, lifetime_value, preferred_contact_method, best_contact_time

**The overlap:**
Both show client context on the invoice detail. Analytics enriches the existing card rather than replacing it.

**Resolution:**
- Add a "Payment History" sub-section below the existing Client Info card
- Show: reliability score badge, avg days to pay, lifetime value
- Show "Best time to call" and "Responds to reminders" as small indicators
- Same section, enriched -- not a separate panel

---

## 9. Send Invoice Modal vs. Portal Link Sharing

**What exists (SendInvoiceModal.tsx):**
- 4-step flow: Generate PDF, Send via Gmail, Sync to QBO, Update status
- CC email field
- Mock implementation for all steps

**What's planned:**
- Customer portal with `/pay/:token` route
- "Copy Portal Link" button

**The overlap:**
Sending an invoice email could include the portal link. These complement each other.

**Resolution:**
- Add the portal link to the invoice email body (using the email template merge field `{{portal_link}}`)
- Add "Copy Portal Link" as a new action in InvoiceDetailSheet (next to Preview PDF / Download)
- Portal link generation happens when invoice is first sent (auto-create token)
- No changes to SendInvoiceModal flow -- it just includes the link in the email content

---

## Summary: What's Truly New vs. What's an Enhancement

| Feature | Status | Approach |
|---------|--------|----------|
| Follow-up notes | EXISTS | Enhance with optional promise fields |
| Reminder emails | EXISTS | Add AI generation inside existing dialog |
| Demand letters | EXISTS | AI suggests using existing flow |
| Collections grouping | EXISTS | Add AI priority toggle to same view |
| Activity log | EXISTS | Extend with automation entries |
| Collections settings | EXISTS | Evolve into automation rules (Phase 4) |
| Write-off | EXISTS | Keep as-is, separate from disputes |
| Client info card | EXISTS | Enrich with payment analytics |
| Send invoice flow | EXISTS | Add portal link to email template |
| Risk scoring | NEW | New tables + edge function + badges |
| AI message generation | NEW | Edge function, surfaced in existing dialogs |
| Payment promises | NEW | New table, integrated into note form |
| Customer portal | NEW | New public route + token system |
| Disputes | NEW | New table, section in detail sheet |
| Payment plans | NEW | New tables, portal + staff approval |
| Cash flow forecasting | NEW | New edge function + Analytics tab |
| Automation rules | NEW | Replaces simple collections settings |

---

## Recommended Implementation Approach

Build in layers that enhance existing UI before adding new surfaces:

1. **Database tables first** (all new tables in one migration)
2. **Edge functions** (risk scoring, AI messages, analytics aggregation)
3. **Enhance existing components** (risk badges on collection cards, AI button in reminder dialog, promise toggle in note form, analytics in client card)
4. **New sections in detail sheet** (disputes, promises -- within the existing sheet, not new pages)
5. **New tabs last** (Promises dashboard, Analytics dashboard -- only after the data is flowing)
6. **Portal and automation** (future phases, fully new features)

This way nothing gets rebuilt, and every enhancement feels like a natural extension of what users already know.

