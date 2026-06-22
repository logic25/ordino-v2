## Scope (revised)

Three connected bugs, all to fix in this batch:

### A. Bug‑alert email "From" should match the reporter

**Today:** `send-bug-alert` picks `gmail_connections` row by caller, otherwise falls back to `connections[0]` — usually Don. Recipient sees "From: don@…" even though body says "Reporter: Sheri".

**Fix:**
- Resolve sender connection in this order:
  1. `gmail_connections` row whose `user_id` (profile id) = reporter's profile id, or whose `email_address` matches the reporter's auth email.
  2. `gmail_connections` row whose `email_address` = `info@greenlightexpediting.com` (or, generalised, the company's configured `companies.email` / `settings.company_email`).
  3. Hard fallback: `connections[0]` (current behaviour) — only if neither of the above exists.
- Also pass a display name to `gmail-send` so the From header reads `"Sheri Quinones (Bug Report)" <…>` even when the connection account differs. (Requires adding an optional `from_name` field to `gmail-send`; other callers unaffected.)

### B. Email signature inheritance

**Today:** Composed and bug‑alert emails contain no signature. There's no per‑user signature field anywhere in the app — users assumed the Gmail signature would carry over, but Gmail's `users.settings.sendAs` signature is only auto‑appended by the Gmail web client, not by API sends.

**Fix:**
- On Gmail connect (and once per day on send), call `GET https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs`, pull the matching `sendAs` entry's `signature` HTML, and cache it on `gmail_connections.signature_html` (new nullable text column).
- In `gmail-send`, when the request does not already contain a signature marker (`<!-- signature -->`), append `<br><br>--<br>{signature_html}` before building the MIME body.
- In `ComposeEmailDialog`, pre‑fill the editor with the cached signature on open (skip when replying/forwarding so it isn't duplicated).
- Add a small "Email signature" panel in Settings → Profile that shows the synced Gmail signature read‑only with a "Resync from Gmail" button. (Editing is out of scope — keep Gmail as the source of truth so it stays consistent across surfaces.)

### C. Beacon bug‑report subject leaks the system prompt

**Today:** Subjects like `[INSTRUCTIONS: Respond conversationally like a knowledgeable colleague. Lead wit…]` and `[Email] [Page: Email] emails only show…` end up in the email subject/body because Beacon is shoving its own system prompt into the title.

**Fix (just the title sanitisation — Beacon prompt cleanup is a separate ticket):** In the bug‑report capture path (`src/components/helpdesk/BugReports.tsx` / the function that writes the row), strip any leading bracketed `[INSTRUCTIONS: …]` / `[Context: …]` blocks and the `[Page: X]` page tag from `title` before save, and store the page name in the existing `page` column. Apply the same strip to legacy rows on read in `send-bug-alert` as a belt‑and‑braces guard so existing un‑fixed bugs also email cleanly.

## Out of scope (filed as separate tickets)

- **Email list "no name, no signature" rendering bug** (Natalia's screenshot of the Emails page): different bug — the Emails list view isn't resolving contact display names or rendering inbound signatures. Needs its own investigation in `EmailList.tsx` / `EmailDetailSheet.tsx`.
- **Beacon assistant leaking its full system prompt into bug‑report titles**: root cause is in the Beacon "Report a bug" prompt construction, not in Ordino. We sanitise the title on intake (C above) but the underlying Beacon prompt should also stop dumping instructions.
- **General per‑user editable signatures** (rich‑text editor, multiple signatures, per‑project signatures): defer — current request is just "inherit from Gmail", which B covers.

## Technical changes

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Add `gmail_connections.signature_html text`, `gmail_connections.signature_synced_at timestamptz`. |
| `supabase/functions/gmail-send/index.ts` | Accept optional `from_name`; build `From: "name" <addr>` (RFC‑2047 encode non‑ASCII). Append `signature_html` to body when not already present. |
| `supabase/functions/send-bug-alert/index.ts` | Reporter→sender resolution chain; pass `from_name`; sanitise legacy titles. |
| `supabase/functions/gmail-sync/index.ts` (or a new `gmail-sync-signature`) | Fetch `sendAs` signature and persist on connection. Trigger on connect + on send when stale (>24h). |
| `src/components/emails/ComposeEmailDialog.tsx` | Pre‑fill editor with cached signature on new compose. |
| `src/components/helpdesk/BugReports.tsx` (or the bug‑creation hook/function) | Strip `[INSTRUCTIONS …]` / `[Context …]` / `[Page: X]` from title at write time; persist page separately. |
| `src/pages/Settings.tsx` (Profile section) | Read‑only signature preview + "Resync from Gmail" button calling the sync function. |

## Verification

1. File a bug as Sheri (no Gmail connection) → email arrives From `info@greenlightexpediting.com` with display name `Sheri Quinones (Bug Report)`.
2. File a bug as Don (Gmail connected) → email arrives From `don@greenlightexpediting.com` with display name `Don … (Bug Report)`.
3. Compose a new email in the app → editor shows the current Gmail signature; recipient sees it once (not twice).
4. Send a reply → signature is not duplicated.
5. Existing bug rows with `[INSTRUCTIONS …]` titles → next email notification has the cleaned title.
