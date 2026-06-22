# Plan: Fix Beacon bug-report formatting + ping Sheri

## Part 1 — Make Beacon bug reports readable

**Problem.** `beacon-proxy/index.ts` currently writes the full enriched query (with `[INSTRUCTIONS: ...]` and `[Context: ...]` blocks) into the bug `description`, then appends Beacon's reply. The user's actual three-word message ("Cannot save an application") gets buried at the bottom of a 30-line scaffolding dump, which is why we couldn't see what Sheri reported.

**Fix.** In `supabase/functions/beacon-proxy/index.ts` around line 484–499 (the bug-insert block):

1. **Reuse the existing cleaner.** The function already strips scaffolding for the title — apply the same regex to the description body, not just the title.
2. **Reorder the description** so it reads:
   ```
   **What Sheri said:**
   Cannot save an application

   **Where:** Projects page
   **Project context:** 842 Rockaway Ave — 2026-0738 — Sheri Test (if a project context was attached)
   **Beacon's response:**
   I need more details to help you troubleshoot this...
   ```
3. **Drop the raw `[Context: ...]` blob from the description** — keep the human-readable bits (project name/address/number when present) by reading `project_context` fields directly instead of re-serializing the bracket string.
4. Keep the existing auto-capture block (`---\n**Auto-captured context:**\n...`) appended after, untouched. That's what `attach-bug-evidence` adds.

**One-file change.** No new migrations, no UI changes. The triage edge function reads `description`, so a cleaner description = better triage too.

**Verify.** After deploy, file a test bug from Beacon ("test bug ignore — checking format") and read the resulting `feature_requests` row to confirm the user message is at the top.

## Part 2 — Ping Sheri for clarification on bug `68c026c7`

No code. Draft a short Google Chat / email message you can send her:

> "Hey Sheri — saw your Beacon report on the 842 Rockaway project that you couldn't save an application. Which save was it? The Change Order you just created, a DOB job number, the project itself, or one of the services? And do you remember the exact error or button behavior? A screenshot would help too. Thanks!"

If you'd rather I push this through the existing Google Chat integration (we have `useGoogleChat` and the chat module), I can wire a one-click "Ask Reporter" button on the BugReports detail view in a follow-up — but that's a separate task; not in scope here.

## Files touched

- EDIT `supabase/functions/beacon-proxy/index.ts` (the bug-insert block, lines ~484–500)

## Out of scope

- The actual "cannot save" bug — unactionable until Sheri replies.
- Auto-capture changes — already shipped.
- A button to message the reporter from the bug detail UI — flag for later if you want it.
