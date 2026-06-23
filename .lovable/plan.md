
## Goal

Make demand letters context-rich (Camaj-style), generate a PDF version, auto-email with certified-mail tracking, and add **optional** contractual late-payment interest accrual that's **off by default** until you review with Chris.

## Part 1 — AI-drafted demand letter

### New edge function `generate-demand-letter`

Input: `{ invoice_id, scope?: "client" | "property" }` (default `"client"`).

Server work (all `company_id`-scoped to caller):

1. Resolve trigger invoice → `client_id`.
2. Load **all** of that client's past-due invoices (status `sent` + `due_date < today`, or `overdue`) with project, service line-items, DOB `job_number`s, and applied retainer transactions (for net-of-retainer amounts).
3. Load distinct underlying **proposals** via `projects.proposal_id` → `proposal_number`, `signed_at`, project address, `terms_and_conditions` / `agreement_html`.
4. Load primary **Bill To** contact + mailing address from `client_contacts` / `clients`.
5. Load company name/address/phone/email/managing-member from `companies` + `company_settings`.
6. If interest is enabled (Part 4), compute accrued interest per invoice and pass to the AI.
7. Call Lovable AI Gateway (`google/gemini-3-flash-preview`) with strict prompt:
   - All structured data as JSON.
   - Camaj letter passed as a **format-only** few-shot exemplar (never as facts).
   - Hard rules: never invent invoice numbers/dates/amounts/clauses; only quote clauses present in supplied terms text; omit DOB sentence if no `job_number`; keep the 10-business-day demand; use the agreement's actual interest rate when present, fallback to "9% statutory post-judgment" otherwise.
   - Return JSON `{ subject, body }` (plain text with line breaks).
8. Log to `ai_usage_logs`. Return `{ subject, body, totals, invoice_ids, accrued_interest, warning? }`.

### Client wiring

- New `useGenerateDemandLetter` hook.
- `openDemandLetter()` becomes async: spinner "Drafting from invoice + agreement context…", drops returned body into the existing editable textarea.
- Demand dialog top toggle: **"This client (all past-due) · This property only"** (default client-wide).
- Summary chip-row: `7 invoices · 2 properties · $7,477.00` (+ accrued interest only when feature enabled).
- `logFollowUp` writes a row on **every** invoice the letter covered.
- Email is **CC'd to admins** by default (resolved from `user_roles` + `profiles`); CC list shown and editable.

## Part 2 — PDF version

Single source, two outputs:

1. **Email body** — branded HTML via existing `buildDemandLetterEmail`.
2. **PDF attachment** — new `DemandLetterPDF.tsx` using `@react-pdf/renderer`: company letterhead, certified-mail line, addressee block, Re: line, body, itemized table grouped by property, signature block.

Dialog preview gets a sub-tab toggle: **Letter Body | PDF Preview**. Send button:

- Attaches the PDF to the outbound email (extend `gmail-send` to accept `attachments: [{ filename, contentBase64, mimeType }]` and append MIME parts).
- Uploads the PDF to Storage at `invoice-documents/<company_id>/demand-letters/<filename>.pdf` and logs the path in `invoice_activity_log` on every covered invoice.
- Filename: `Demand-Letter-<ClientName>-<YYYY-MM-DD>.pdf`.
- "Download PDF" button always available for print/USPS.

## Part 3 — Certified-mail tracking

Persistent banner on any invoice with a demand letter sent: **"Certified mail not yet logged — paste USPS tracking #"** with an input.

New table `invoice_certified_mailings`:
- `invoice_id`, `demand_letter_activity_id`, `usps_tracking_number`, `mailed_date`, `delivered_date` (nullable, manual), `return_receipt_url` (optional storage path), `notes`, standard timestamps + `company_id`.
- RLS per project doctrine; grants `authenticated` + `service_role`.
- Tracking # renders as link → `https://tools.usps.com/go/TrackConfirmAction?tLabels=<num>`.
- Banner disappears once tracking # is logged.

## Part 4 — Interest accrual (off by default, fully toggleable)

**Master switch:** `companies.late_interest_enabled boolean default false`. When `false`, every interest pathway short-circuits:

- View returns `accrued_interest_to_date = 0`.
- Invoice list column is hidden.
- Invoice detail line is hidden.
- Demand-letter generator does **not** compute or quote interest (falls back to "9% statutory post-judgment" language).
- Proposal-builder Terms section does **not** auto-insert the interest clause.
- Snapshot writes are skipped.

This lets you ship the full plumbing now, leave it off, and flip it on after the Chris review with one toggle in Settings.

### Schema (one migration)

1. `companies` — add:
   - `late_interest_enabled boolean default false` ← **master switch**
   - `default_late_interest_rate_apr numeric(5,2) default 18.00`
   - `default_interest_grace_days int default 0`
   - `default_interest_compounding text default 'monthly'`
   - `interest_clause_effective_from date null` ← only proposals signed on/after this accrue interest
2. `proposals` — add `late_interest_rate_apr numeric(5,2) null`, `interest_grace_days int null`, `interest_compounding text null`. NULL = use company default; existing signed proposals stay NULL.
3. New SQL view `public.invoice_balances_with_interest`:
   - If `late_interest_enabled = false` OR proposal `signed_at < interest_clause_effective_from` → `accrued_interest_to_date = 0`.
   - Else: resolves rate via invoice → project → proposal → company default; computes simple or monthly-compounded interest from `due_date + grace_days`.
   - Returns `principal`, `interest_rate_apr`, `interest_start_date`, `accrued_interest_to_date`, `total_owed`.
4. New table `invoice_interest_snapshots` (`invoice_id`, `as_of_date`, `principal`, `rate_apr`, `days_overdue_for_interest`, `accrued_interest`, `source` `'demand_letter' | 'payment' | 'manual'`, `created_by`, `company_id`). RLS + grants per doctrine.

### Default clause text (auto-inserted into new proposals only when feature is ON)

> *"Invoices are due Net 30. Past-due balances accrue interest at 1.5% per month (18% APR), compounded monthly, from the due date until paid in full. Client agrees to pay all collection costs, including reasonable attorney's fees."*

### UI surfacing (all conditional on `late_interest_enabled`)

- **Settings → Invoice Settings → "Late-Payment Interest" section:**
   - Master ON/OFF toggle (default OFF), with helper text *"Off while under review. Turn on to start accruing interest on new agreements signed after the effective date."*
   - Rate / grace / compounding / effective-from inputs (disabled when toggle is OFF).
- **Invoice list:** optional `Accrued Interest` column (hidden when feature OFF; otherwise toggle in column-picker).
- **Invoice detail:** `+ $X.XX interest @ 18.00% APR since <date>` line only renders when feature ON **and** rate > 0.
- **Proposal builder Terms section:** optional per-proposal overrides; default clause auto-inserted only when feature ON.
- **Demand-letter generator:** includes interest only when feature ON for that agreement.

## Out of scope

- No automated nightly interest cron (read-time view + on-demand snapshots).
- No partial-payment interest allocation rules.
- No retroactive interest on pre-launch signed agreements (Camaj et al.) — guaranteed off by both the master toggle and the effective-from guard.
- No statement-of-account generator.
- No USPS API integration (manual tracking-# entry only).
- No changes to reminder/write-off flows.

## Files touched

- `supabase/functions/generate-demand-letter/index.ts` *(new)*
- `supabase/functions/gmail-send/index.ts` *(add attachments array)*
- `supabase/migrations/<ts>_demand_interest_certified_mail.sql` *(schema + view + 2 new tables + RLS + grants)*
- `src/hooks/useDemandLetter.ts` *(new)*
- `src/hooks/useCertifiedMailings.ts` *(new)*
- `src/hooks/useInvoices.ts` *(read from `invoice_balances_with_interest`)*
- `src/hooks/useBillingEmail.ts` *(`subjectOverride` + `attachments`)*
- `src/components/invoices/invoice-detail/useInvoiceActions.ts` *(call generator, attach PDF, log per invoice, snapshot interest)*
- `src/components/invoices/invoice-detail/ActionDialogs.tsx` *(scope toggle, CC chips, Letter/PDF sub-tabs, Download PDF)*
- `src/components/invoices/invoice-detail/CertifiedMailBanner.tsx` *(new)*
- `src/components/invoices/DemandLetterPDF.tsx` *(new — @react-pdf/renderer)*
- `src/components/settings/InvoiceSettings.tsx` *(interest section with master toggle, relabel old template as fallback)*
- `src/components/proposals/<terms editor>.tsx` *(conditional default clause + per-proposal overrides)*
