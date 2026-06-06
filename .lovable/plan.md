# Generate Fix Prompt — Bug Reports

Replace the existing minimal "Copy for Lovable" button in the bug detail sheet with a richer **Generate Fix Prompt** action. One click assembles every piece of context a coding agent needs and copies it to the clipboard. The user pastes into Claude Code or Lovable; nothing autonomous runs.

## User flow

1. Open a triaged bug in the detail sheet
2. Pick destination tool from a small dropdown next to the button: **Claude Code** or **Lovable** (defaults to last choice in localStorage)
3. Click **Generate Fix Prompt** — spinner shows while the edge function assembles file contents
4. Toast confirms copy; prompt is on the clipboard, ready to paste

The button is enabled even without triage, but shows a tooltip recommending "Run AI Triage first" when `ai_diagnosis` is empty.

## What goes into the prompt

A single markdown block, structured for fast scanning by a coding agent:

1. **Header** — bug id, title, page, priority, status, destination tool
2. **Reproduction** — description, expected vs actual, repro steps, Loom URL, screenshot URLs
3. **AI triage** — severity, root cause, suggested fix, complexity, suggested files (verbatim from triage)
4. **Similar past bugs** — top 3 `bug_patterns` rows ranked by file overlap + keyword match against this bug (same scoring already used in `triage-bug-report`); each shows pattern name, occurrences, root cause, prior fix
5. **Current file contents** — for each path in `ai_suggested_files`, a fenced code block with the live file contents (see "File contents source" below)
6. **Acceptance criteria** — auto-generated checklist:
   - Original repro no longer reproduces
   - No regressions in adjacent components listed
   - Tests pass (`bun run test` if test file is touched)
   - Changelog entry added per project rule
7. **Tool note** — different closing line depending on dropdown choice:
   - Claude Code → "You have filesystem access — re-read files before editing in case they changed."
   - Lovable → "Apply the smallest change that fixes the bug. Reference the file paths above."

## File contents source

A new edge function **`assemble-fix-prompt`** does the assembly server-side because the browser can't read repo files. It accepts `{ bug_id, target_tool }`, verifies the caller's company matches the bug (same pattern as `triage-bug-report`), and fetches file contents from the connected GitHub repo via the raw API.

Required to make this work:
- `GITHUB_TOKEN` secret (PAT with `repo` read scope on the Ordino repo)
- `GITHUB_REPO` secret (e.g. `your-org/ordino`)
- `GITHUB_BRANCH` secret (defaults to `main`)

If `GITHUB_TOKEN` is not set, the function gracefully falls back: it still returns the full prompt minus file contents, with a line `> Note: GitHub token not configured — agent should read files itself.` This means we can ship the UI immediately and you add the token whenever you want the time-saver to kick in.

Per-file behavior:
- Skip files >1500 lines (include a "file too large, agent should read directly" placeholder)
- Skip directories (paths ending in `/`)
- Cap total prompt size at ~80KB; if over, drop largest files first and note the omission

## Where the code lives

```text
supabase/functions/assemble-fix-prompt/index.ts   NEW — assembles prompt, fetches files
src/components/helpdesk/BugReports.tsx            EDIT — replace copyForLovable with new flow
src/components/helpdesk/fixPromptDestination.ts   NEW — small localStorage helper for last-used tool
```

## UI placement

In the detail sheet, the existing "Copy for Lovable" button currently sits near the comments section. Move it into the AI Triage card footer (or just below it when triage is missing) as a `ButtonGroup`-style cluster:

```text
[ Generate Fix Prompt ▼ Claude Code ]   [ Re-run Triage ]
```

The split-button uses shadcn `Button` + `DropdownMenu`. Selecting from the dropdown both triggers the action and remembers the choice.

## Out of scope (confirmed)

- No webhook triggers
- No GitHub PR creation or write API calls
- No CI integration, no auto-merge
- No changes to `bug_fix_log` flow — `fixed_by` stays user-selected at resolve time

## Changelog

Per the auto-logging rule, the same task inserts a `changelog_entries` row: "Added Generate Fix Prompt to Bug Reports — bundles triage, similar patterns, and current file code into a copy-ready prompt."

## Open decision before build

The plan assumes the **hybrid** approach for file contents (GitHub fetch when token is present, paths-only fallback otherwise) since it's the lowest-friction way to ship without blocking on a PAT. If you'd rather start with paths-only and never add the GitHub fetch, say the word and I'll drop the edge function entirely and do the assembly client-side. The UI surface stays identical either way.
