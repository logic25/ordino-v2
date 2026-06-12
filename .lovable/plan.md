## Locked-in answers from your replies

- **A. Link application:** add a simple manual field (Job # + Type) on the service. Automate later.
- **B. Billed services:** make the row expandable inline (same chevron as active services).
- **C. Pro-Cert intelligence:** stop asking per-service. Read `projects.filing_type` and inject it into the AI / agency-instructions / code-research context automatically.
- **D. Ball in our court:** remove it entirely (toggle, dropdown menu items, dashboard chip, table filter).
- **E. Project numbers:** deferred — not in this batch.
- **F. Needs Review:** keep the tab, add a tooltip explaining what triggers it.
- **G. Calendar + email threading:** proceed with fixes.
- **H. Expense approval:** auto-flow on approve — no second click for the PM.
- **Research tab:** strengthen the system prompt for PM-friendliness, and surface the prompt in the UI (read-only "About this research tool" hover so PMs see what it does and how to ask better questions).

## Plan

### Critical bugs (do first)
1. **Fix `expense_create_billing_request` trigger** — compute `billable_amount` inline (`round(NEW.amount * (1 + COALESCE(NEW.markup_pct,0)/100.0), 2)`) instead of reading the generated column at BEFORE-UPDATE time. Unblocks the toast error on Mark Paid.
2. **Auto-flow expense → billing on approve** — when an expense moves to `approved`, the trigger immediately sets `status = 'pending_billing'` and creates the `billing_requests` row. Remove the "Mark Paid → Bill" button. PM's row shows a green "Approved — Sent to Sai" pill with a tooltip.

### Service-level UX
3. **Manual Application field** (replaces read-only "No application linked"): inline editor with two inputs — Job # and Type (Plan Exam / Pro-Cert / Alt-1 / etc.) — saved on `services.application` jsonb. Edit/clear actions. No DOB picker yet.
4. **Expandable Billed Services row** — same chevron pattern as active services. When expanded, show: line items, invoice link (#INV-xxxx → Billing), paid/sent status, who billed it, related time entries (with hours).
5. **Project Timer service picker** — if project has >1 service, prompt which service on Start Timer; persist `serviceId` in `TimerState`; pass `service_id` to `createEntry` on stop so entries stop landing in "General".

### Project header / project-wide
6. **Pro-Cert pill tooltip + click-to-edit** — tooltip: "Filing type from the PIS. Pro-Cert = professional certification (no DOB plan exam). Click to edit." Clicking opens Edit PIS focused on Filing Type.
7. **Propagate `filing_type` to AI context** — update agency-instructions templates, code-research edge function, and Ask Ordino so they read `project.filing_type` and pre-fill it. Removes the need for users to repeat "this is a Pro-Cert".
8. **Remove "Ball in our court" / Waiting On toggle** — delete `WaitingOnToggle.tsx`, remove the dropdown from project header, remove dashboard `none/client/agency/partner` chips in `PMDailyView.tsx` and `ProjectTable.tsx`, drop the corresponding filter. Keep the underlying column nullable in DB; migration cleanup can come later.

### Billing inbox
9. **Needs Review tooltip** — add an info icon next to the "Needs Review" tab label: "Invoices flagged by accounting or where QBO sync failed. Click to review and resolve."

### Job Costing
10. **KPI tooltips** — each card (Contract, Cost, Gross Profit, Margin, Total Hours) gets a tooltip with formula + source. Add a "View time entries" link from the Cost / Total Hours cards.

### Calendar
11. **Multi-day events in Week view** — repeat the event across each day in `[start, end)`, labeled "Day 1 of 3 / Day 2 of 3 / …" Day-only end dates remain exclusive (per project memory).
12. **Team calendar visibility** — verify whether other users' Google calendars are filtered out for admins; if so, surface them with per-user colored dots and a show/hide toggle so you can see Sheri's events.

### Email
13. **Thread nesting** — group inbox rows by `thread_id`. Root row shows latest message + thread count badge. Click expands inline (newest first), same shortcuts work on root or replies.

### Research tab
14. **Strengthen system prompt** for PM use:
    - Add explicit PM-facing framing: "You are helping a project manager research a code question for a NYC expediting project. Be practical: answer the question, cite the section, then state the practical implication for the filing (e.g., 'this means you'll need TR-1 special inspection'). Avoid jargon when possible."
    - Inject `project.filing_type`, `scope_of_work`, building address into every call (already partly there — make it consistent for both Beacon and LLM fallback paths).
    - Keep plain text rule, keep citation rule, keep "say you don't know" rule.
15. **Surface the prompt + how-to-use** — add an info button next to "Research" header. Opens a small HoverCard showing:
    - One-paragraph "How this tool works" (Beacon KB first, AI fallback, sources cited).
    - 4–6 example questions a PM would actually ask ("Do I need a sprinkler for a 3-story commercial alt?", "What's the egress width for occupant load of 75?").
    - A "Show full system prompt" toggle that reveals the read-only prompt text so PMs can see exactly what the AI was told.
16. **Tooltips on Pin / Notes / Delete / Source-type badge** so PMs know what each control does.
17. **Empty-state copy** is fine; add one-line caption under each sub-tab ("Objections: log examiner objections and draft responses." / "Code Research: ask building/zoning code questions with citations.").

### Always
18. **Changelog entries** for every user-visible change above.

## Out of scope (deferred)
- Project number 4→5 digit format (E).
- Replacing per-service timers with project-only timers.
- Cleaning up the bad 12-hr time entry causing negative margin on the demo project.
- Building a full DOB-application picker (just manual field for now).

## Open questions before I build
None — your answers covered everything. If F's tooltip wording or the "How this tool works" copy needs tweaking, I'll show you in preview and you can edit on the fly.
