

# Ordino Gap Analysis — Go-Live Readiness

## Summary

After auditing all 115 tables, 60+ edge functions, every page, and RLS policies, here are the gaps organized by severity.

---

## 🔴 Critical (Must fix before go-live)

### 1. Security — Sensitive Data Exposure
- **ACH bank info**: Any company member can read all ACH authorizations (routing numbers, account numbers). Should be admin-only.
- **QBO OAuth tokens**: All company members can SELECT `qbo_connections` (contains access/refresh tokens). Should be admin-only or token columns excluded.
- **Gmail tokens**: Properly scoped to own user — ✅ OK.
- **Employee reviews/salary data**: All company members can view all employee reviews. Should be restricted to admin + the reviewed employee.

### 2. Security — Beacon (Widget Messages) Has No Company Isolation
- `widget_messages` RLS uses `user_email` matching, not `company_id`. If two companies exist, there's no tenant boundary — just email matching. Not exploitable today (single tenant) but a ticking bomb.

### 3. Security — Billing Rule Documents Missing Company Check on INSERT
- `billing_rule_documents` INSERT policy has no `WITH CHECK` constraint — any authenticated user can insert docs into any company's billing rules.

### 4. No OOO / Handoff Feature (Approved Plan, Not Built)
- The profiles table has no `ooo_from`, `ooo_to`, `ooo_covering_pm_id` columns yet. The approved plan hasn't been implemented.

---

## 🟡 Important (Should fix for go-live)

### 5. Open Bugs (3 in "ready for review")
- **RFP resume attachments** not sending with response emails
- **RFP logo/branding** — redesign implemented but needs verification
- **Email forwarding** — original text still missing, awaiting log capture from Chris's next test

### 6. No Error Boundary / Crash Recovery
- The "Something went wrong" page users keep seeing suggests missing error boundaries or unhandled promise rejections on key pages.

### 7. No Audit Trail for Sensitive Actions
- No logging when someone views ACH data, exports invoices, or changes user roles. For a financial tool, this matters.

### 8. Missing Data Validation
- Several tables with 1 RLS policy (SELECT only, no INSERT/UPDATE/DELETE policies): `billing_notification_preferences`, `billing_schedules`, `beacon_corrections`, etc. These might allow uncontrolled writes.

---

## 🟢 Nice-to-Have (Post-launch)

### 9. Feature Backlog (from `feature_requests`)
- Plan versioning
- IBM number tracking
- Permit tracking
- OOO/Handoff (approved, not built)

### 10. Missing Polish
- No onboarding flow for new team members (walkthrough exists but unclear if wired up)
- No mobile-responsive testing evidence
- No rate limiting on public endpoints (RFI form, proposal signing)

---

## Recommended Go-Live Sequence

| Priority | Task | Effort |
|----------|------|--------|
| 1 | Lock down ACH, QBO tokens, employee reviews RLS | 1-2 hrs |
| 2 | Add company_id isolation to widget_messages | 30 min |
| 3 | Fix billing_rule_documents INSERT policy | 10 min |
| 4 | Verify RFP resume + logo fixes | 30 min |
| 5 | Confirm email forwarding fix with logs | Waiting on Chris |
| 6 | Build OOO/Handoff feature | 2-3 hrs |
| 7 | Add error boundaries to key pages | 1 hr |

**Bottom line**: The security gaps (items 1-3) are the real blockers. Everything else is manageable. Want me to start hardening the RLS policies?

