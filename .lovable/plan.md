# AI Collections Upgrade — Implementation Progress

## ✅ Phase 1: Database Foundation (COMPLETE)

### Tables Created
- `payment_predictions` — AI risk scores per invoice
- `client_payment_analytics` — Aggregated payment behavior per client
- `collection_tasks` — AI-prioritized worklist items
- `payment_promises` — Promise-to-pay commitments
- `invoice_disputes` — Dispute tracking
- `dispute_messages` — Threaded dispute conversations
- `cash_forecasts` — Daily forecast snapshots
- Added `write_off_amount` column to `invoices`

All tables have RLS with company isolation (is_company_member for SELECT, is_admin_or_manager for ALL).

### Edge Functions Deployed
- `analyze-client-payments` — Aggregates client payment history into analytics
- `predict-payment-risk` — AI risk scoring via Gemini 3 Flash
- `generate-collection-message` — AI contextual email generation

### Hooks Created
- `usePaymentPredictions` — Fetch/request risk scores
- `useClientAnalytics` — Fetch/refresh client payment analytics
- `usePaymentPromises` — CRUD for payment promises
- `useCollectionMessage` — Generate AI collection messages

---

## 🔲 Phase 2: Enhanced Collections UI (NEXT)

### 2A. Risk Score Badges on Collection Cards
- Add colored risk badge to each invoice card in CollectionsView
- Show predicted payment date below days overdue

### 2B. AI Worklist Mode Toggle
- Toggle at top of CollectionsView: "Urgency Groups" vs "AI Priority"
- AI mode sorts by priority, shows recommendations

### 2C. AI Message Generation in Reminder Dialog
- "Generate with AI" button in existing reminder dialog
- Tone/urgency selectors, payment plan offer toggle

### 2D. Promise-to-Pay in Note Forms
- "Log Promise" toggle in CollectionsView quick note and InvoiceDetailSheet note form
- Reveals structured fields: amount, date, method

### 2E. Client Payment Analytics in Detail Sheet
- Add reliability score, avg days, lifetime value below Client Info

---

## 🔲 Phase 3: Promises Tab & Analytics Tab

### Promises Tab
- Grouped by due date: Today, Tomorrow, This Week, Overdue
- Status badges, mark received/follow up/reschedule actions

### Analytics Tab
- Collections rate, avg days to pay metrics
- Collections by age chart (recharts)
- Cash flow forecast display

---

## 🔲 Phase 4: Customer Portal (Future)
## 🔲 Phase 5: Automation Rules (Future)

---

## Overlap Resolutions (Reference)

See previous conversation for full overlap analysis. Key decisions:
1. Follow-up notes enhanced with optional promise fields (not replaced)
2. Reminder dialog enhanced with AI generation (not separate composer)
3. Collections view gets toggle, not separate worklist page
4. Activity log extended with automation labels
5. Disputes managed within invoice detail sheet
6. Collections settings evolve into automation rules in Phase 5
