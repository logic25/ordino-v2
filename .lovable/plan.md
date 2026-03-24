

## Plan: Fix Bug Tracker Email Branding + Comment Thread Visibility

### Problems
1. **Bug emails don't use branded templates** — All 5 bug email types (new report, comment, resolved, reopened/in-progress, ready for review) use hardcoded HTML with different colored headers (purple, green, orange, blue) instead of the branded email shell from the gallery.
2. **Comment email lacks thread context** — When you comment to update the reporter, they get an email with just the single comment. The recent comments thread is only included in status-change emails (resolved, reopened, ready for review, in progress). If you just comment without changing status, the reporter has no thread context.
3. **No admin response visible in email** — The comment notification email doesn't include prior comments, so the reporter can't see the conversation history without logging in.

### Solution

#### 1. Wire `send-bug-alert` edge function to use branded template shell
- Rebuild the edge function to fetch company settings (logo, address, phone, email, accent color, style config, and `email_template_overrides`) from the database
- Use the same branded HTML shell pattern as proposals/invoices/COs — logo header, company info, accent stripe, branded CTA button
- Apply the `bug_report` template from the gallery for new reports, and appropriate template text for comment/status emails
- Since this is an edge function, replicate the `buildBrandedEmailHtml` rendering logic inline (edge functions can't import from `src/`)

#### 2. Include recent comment thread in comment notification emails
- When `action === "comment"`, fetch the last 5 comments on that bug (same as status-change emails already do) and render them in the email body
- This way the reporter (or admin) sees the conversation context without logging in
- The commenter's new comment will be at the bottom of the thread, clearly showing what was said

#### 3. Add gallery templates for all bug email variants
- The gallery already has `bug_report` — add entries for:
  - `bug_comment` — "New Comment on Bug"
  - `bug_resolved` — "Bug Resolved"  
  - `bug_status_change` — "Bug Status Update" (covers in_progress, reopened, ready_for_review)
- Add these to `TEMPLATE_DEFAULTS` in `buildBrandedEmailHtml.ts` and to the gallery template list in `EmailTemplateGallery.tsx`

### Files to update
- **`supabase/functions/send-bug-alert/index.ts`** — Rebuild all HTML to use branded shell, add comment thread to comment emails, fetch company/style settings from DB
- **`src/lib/buildBrandedEmailHtml.ts`** — Add `bug_comment`, `bug_resolved`, `bug_status_change` default templates
- **`src/components/settings/EmailTemplateGallery.tsx`** — Add the 3 new template entries to the gallery list
- **`src/components/helpdesk/BugReports.tsx`** — Pass `recent_comments` data in the comment action invoke (fetch last 5 comments before sending)

### Technical notes
- The edge function will query `company_settings` for logo, address, style config, and template overrides — same pattern used by `send-billing-notification`
- The branded shell will be built inline in the edge function since it can't import from `src/`
- Comment thread rendering will cap at 5 most recent comments for email length sanity

