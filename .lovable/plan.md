

# Email Template Gallery — Full Update

## Summary
Apply all previously planned changes (revised copy for existing templates + 3 new templates) AND add 3 additional templates the user selected.

## All changes in `src/components/settings/EmailTemplateGallery.tsx`

### 1. Update existing template defaults (lines 70–175)
Replace `defaults` for each template with the revised copy from the previous plan:
- **proposal** — subject: `"Proposal {{PROPOSAL_NUMBER}} · {{PROJECT_TITLE}}"`, detailed body about scope/fee/signing, new signoff
- **change_order** — casual tone, scope change language, new signoff
- **welcome** — introduces PM, PIS CTA, new signoff
- **invoice** — includes `{{DUE_DATE}}`, payment terms signoff
- **reminder** — overdue language, new signoff about resolving issues
- **billing_digest** — keep as-is
- **billing_alert** — keep as-is
- **partner_outreach** — GLE-specific pitch copy

### 2. Add 6 new templates to TEMPLATES array (after partner_outreach)

**From previous plan:**
- `checklist_followup` — "Checklist Follow-up", category: client, nudges for outstanding items
- `project_closeout` — "Project Closeout", category: client, DOB sign-off confirmation
- `payment_received` — "Payment Received", category: client, payment receipt with balance

**New additions (user selected 5, 6, 7):**
- `status_update` — "Project Status Update", category: client. Periodic milestone update with completed tasks, upcoming items, and any blockers. Defaults: subject `"Project Update — {{PROJECT_TITLE}}"`, body about current status, no CTA.
- `demand_letter` — "Demand Letter", category: client. Formal payment escalation. Subject `"FORMAL DEMAND — {{INVOICE_NUMBER}}"`, stern body referencing amount/days overdue, legal action warning. Uses red accent stripe in preview instead of green.
- `referral_thankyou` — "Referral / Thank You", category: client. Post-completion relationship nurture. Subject `"Thank You — {{PROJECT_TITLE}}"`, body thanking for business, asking for referrals.

### 3. Update `docLabels` (~line 232)
Add entries for all 6 new template IDs.

### 4. Add variables to `variableHints` (~line 674)
- `{{DUE_DATE}}` — "Invoice due date"
- `{{BALANCE}}` — "Remaining account balance"

### 5. Add resolvers in `resolve()` (~line 204)
- `{{DUE_DATE}}` → "April 18, 2026"
- `{{BALANCE}}` → "$0.00"

### 6. Add 6 new cases in `buildTemplateBody` switch (~line 319)

- **checklist_followup** — Amber accent border-left, checklist table with checkbox-style squares, item name, date requested. PM contact card below.
- **project_closeout** — Green centered checkmark icon (✓), filing summary table: Application Type, Job Number, Filed Date, Sign-Off Date.
- **payment_received** — Green centered checkmark, large green amount, receipt table: Payment Date, Method, Invoice, Remaining Balance.
- **status_update** — Progress-style layout with a milestone table (Task, Status with colored dots for Complete/In Progress/Pending), and a "Blockers" callout card below in amber.
- **demand_letter** — Red accent styling. Large red amount due, days overdue counter, formal letter body in serif-style block, legal warning box with red border.
- **referral_thankyou** — Green checkmark header, warm body text, optional "Leave a Review" CTA button, and a "Refer a colleague" secondary link.

### No other files affected

