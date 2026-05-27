## What we know

- You clicked Sync. The `gmail-sync` edge function ran from 18:56:32 to 18:59:52 (~3m 20s), then was force-shut down by the runtime (edge functions cap around 150s and the client connection drops well before that). The browser likely got an aborted request, no toast, and the email list never refreshed.
- The function logs also show one `Insert error: code 57014 (canceling statement due to statement timeout)` on the `emails` insert at 18:57:38. That's a single DB statement that got killed — most likely a side effect of the function being heavily blocked on slow per-message work, not a schema problem.
- New emails DID land in the DB (latest `synced_at` is 18:59:51, i.e. some rows were saved before shutdown), but because the function never returned, React Query never invalidated `["emails"]`, so the UI didn't refetch. A manual page refresh would probably show them.

## Root cause

Two compounding problems in `supabase/functions/gmail-sync/index.ts`:

1. **Bug-reply detection loop is O(emails × profiles).** For every synced message whose subject contains `[BUG-xxxxxxxx]`, the function loops over every active profile in the company and calls `supabase.auth.admin.getUserById(...)` one by one to match the sender. With ~10 profiles and a normal page of bug-tagged emails, this is dozens of round-trips per message, every sync. This is the main wall-clock killer.
2. **Everything is serial.** For each of up to 150–500 messages per sync we do: 1 existence SELECT, 1 Gmail `messages.get`, 1 INSERT, optional attachment INSERT, plus the bug loop above. With this much serial work the function regularly blows past the edge-runtime time limit, the client connection is closed, and the UI never refreshes.

## Plan

1. **Pre-fetch the profile → email map once per sync.** Before the page loop, call `auth.admin.listUsers()` (or query profiles joined to a cached user-email map) one time and build `Map<email, profile_id>`. Replace the inner `for (sp of senderProfiles) { getUserById(...) }` loop with a single map lookup. This is the biggest win — turns ~N×M auth calls into 1.
2. **Add a wall-clock budget.** Track `startedAt` at the top of the handler. Before each new page, if `Date.now() - startedAt > 60_000`, break out of the page loop, update `last_sync_at`, and return a normal response with whatever was synced (plus `partial: true`). This guarantees the function always returns to the client and the UI always invalidates, even on big mailboxes.
3. **Skip the existence SELECT by using upsert with `ignoreDuplicates`.** Replace the per-message `select id ... maybeSingle()` + `insert` pattern with a single `upsert({...}, { onConflict: "gmail_message_id,company_id", ignoreDuplicates: true })` against the existing unique index `idx_emails_gmail_id_company`. This cuts one round-trip per message in half.
4. **Tighten the existing `Insert error` handling.** If insert fails (e.g. statement timeout), retry the insert once with a 500ms backoff before `continue`-ing. One transient timeout shouldn't silently drop a message.
5. **No client-side changes needed.** `useSyncGmail` already invalidates `["emails"]` on success — it just needs the function to actually return.
6. **Manual verification after deploy.** Have you click Sync once. Confirm: (a) the function returns within ~60s, (b) the toast shows `Synced N new emails`, (c) the inbox list refreshes without a manual reload. Then check `gmail-sync` logs for zero `Insert error` entries.

## Why this matches what you saw

You clicked Sync, the function got stuck in the bug-reply loop and hit the runtime time limit, the request was killed mid-flight, React Query never invalidated, and the inbox view kept showing the old cached list — so the synced emails were "missing" even though some of them were already in the DB.

## Technical details

- File: `supabase/functions/gmail-sync/index.ts`
  - Add `const startedAt = Date.now()` near line 213.
  - Add `if (Date.now() - startedAt > 60_000) break` at the top of each `pagesProcessed` loop iteration.
  - Build `senderEmailToProfileId: Map<string, string>` once after fetching `profile`, replacing the per-email loop at lines 295–318.
  - Swap the `select` + `insert` at lines 236–388 for a single `upsert({...}, { onConflict: "gmail_message_id,company_id", ignoreDuplicates: true }).select("id").maybeSingle()`. Treat a `null` return as "already existed" and skip attachment insert in that case.
  - Wrap the upsert in a single retry on `57014`.
  - Response shape stays the same (`{ synced, total_checked, pages_processed }`) plus optional `partial: true` when the budget cut us off.
- No schema changes. No frontend changes. No new env vars. Deploy `gmail-sync` only.
- Risk: very low. The bug-reply behavior is preserved (map lookup instead of slow loop); the upsert relies on an index that already exists; the time budget only ever shortens a run, never lengthens it.

If you want, after the fix lands I can also add a one-line `[gmail-sync]` summary log per run (counts + ms elapsed) so future "sync didn't work" reports are diagnosable in 5 seconds instead of guessing from edge-function logs.