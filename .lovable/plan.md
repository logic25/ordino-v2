# Plan: Beacon Bug Auto-Capture + Roadmap Parking

## Part 1 — Beacon bug auto-capture (build now)

**Goal:** When a user describes a bug in Beacon, we silently capture full evidence (screenshot, HTML, console errors, network failures, browser info) and attach it to the auto-logged `feature_requests` row. No paperclip, no user action.

**What already exists:**
- `beacon-proxy` detects bug intent server-side and inserts a `feature_requests` row with `category: "bug_report"`.
- `BeaconChatWidget` already passes `currentPage` and last 3 `recentErrors` to the proxy.
- Triage runs fire-and-forget after insert.

**What's missing (the four captures):**
1. **Screenshot** of the current viewport
2. **HTML snapshot** of `document.documentElement.outerHTML`
3. **Network failures** in the last ~30s (status >= 400 or rejected fetch)
4. **Browser/viewport metadata** (UA, viewport, URL, timestamp)

### Implementation

**a) Client-side capture helpers** (`src/lib/beaconCapture.ts`, new)
- `recentNetworkFailures` ring buffer: monkey-patch `window.fetch` once at app boot to record `{url, status, ms, ts}` for failed requests; keep last 20, drop entries older than 30s.
- `captureSnapshot()`: calls `html2canvas` on `document.body` (downsized to max 1280px wide, JPEG 0.7), gzips `outerHTML` via `CompressionStream`, returns `{screenshotBlob, htmlGz, network, ua, viewport, url}`.
- Lazy-import `html2canvas` only when called so it doesn't bloat the main bundle.

**b) Boot the network recorder** in `src/main.tsx` (one line: `import "@/lib/beaconCapture/recorder"`).

**c) Cheap client-side bug pre-check** in `BeaconChatWidget.handleSend`
- Mirror the server's bug keywords (broken, not working, error, doesn't, won't, can't, bug, etc.).
- If pre-check matches: `await captureSnapshot()` BEFORE calling `askBeacon`. Cost is ~200–500ms; only paid when likely a bug.
- If no match: skip capture entirely.

**d) Server returns the new bug id**
- In `beacon-proxy/index.ts`, add `responseJson.bug_id = inserted.id` next to `bug_auto_logged = true`.
- Add `responseJson.bug_id` to `BeaconChatResponse` type in `services/beaconApi.ts`.

**e) Upload + attach after the response**
- New edge function `attach-bug-evidence` (verify_jwt = true):
  - Input: `{ bug_id, screenshot (base64), html_gz (base64), network, ua, viewport, url }`
  - Validates the bug belongs to caller's company_id.
  - Uploads screenshot + html_gz to a new private bucket `bug-evidence/{bug_id}/{screenshot.jpg, page.html.gz}`.
  - Updates `feature_requests` row: `attachments` array gets two signed paths, `description` gets a "**Auto-captured context:**" block appended with UA / viewport / URL / network failure summary.
- Client (`BeaconChatWidget`): after `askBeacon` returns with `bug_auto_logged && bug_id`, fire-and-forget invoke `attach-bug-evidence`. User sees nothing extra.

**f) Storage bucket**
- Create private bucket `bug-evidence` via `supabase--storage_create_bucket`.
- RLS on `storage.objects`: SELECT/INSERT restricted to authenticated users whose company_id matches the bug row's company_id (via a helper SQL function). Admins/service_role full access.

**g) BugFixDashboard surfacing**
- `BugFixDashboard.tsx` already renders `attachments`. Verify screenshot thumbnail + "View HTML snapshot" link render correctly for the new evidence paths. Add a small "Auto-captured" badge when attachments came from Beacon (detect by path prefix `bug-evidence/`).

**h) Changelog** — insert one `changelog_entries` row: "Bug reports from Beacon now auto-capture screenshot, page HTML, recent errors, and failed network requests."

### What we explicitly do NOT do
- No paperclip in Beacon.
- No capture on non-bug messages.
- No persistence of attachments for non-bug chats.
- No new UI surface for the user.

---

## Part 2 — Roadmap parking (shelved until Research tab ships)

Add two entries to the Product Roadmap (`ProductRoadmap.tsx` / `feature_requests` with category `roadmap`, status `planned`):

1. **Project Research tab — attachments + threads**
   - Per-project Research surface gets file upload (image/PDF, ≤10MB, ≤3 per thread), threaded Q&A with Beacon, notes pinning. Scoped to `project_id`. Depends on Research tab going live.

2. **Pre-Project Research page**
   - Top-level `/research` page that mirrors the project Research tab but with no `project_id`. For questions about issues that aren't yet a project (DOB notice photos, address lookups, "what is this objection"). One-click "Convert to Project Research" migrates the thread + attachments to a newly created project. Depends on item 1 shipping first.

Both entries get a note: "Blocked on Research tab v1."

---

## Technical notes

- `html2canvas` adds ~45KB gzipped — lazy-imported so it only loads on first bug send.
- `CompressionStream('gzip')` is native in all evergreen browsers; no polyfill.
- Network recorder uses a closure-scoped array; no globals leak.
- Screenshot JPEG at 0.7 quality, max 1280px wide → typically 100–300KB per bug. HTML gz typically 30–80KB. Negligible storage.
- `attach-bug-evidence` is the only new edge function; everything else is edits.

## Files touched

- NEW `src/lib/beaconCapture/index.ts`, `src/lib/beaconCapture/recorder.ts`
- NEW `supabase/functions/attach-bug-evidence/index.ts`
- NEW migration: create `bug-evidence` bucket + RLS + storage helper fn
- EDIT `src/main.tsx` (one import)
- EDIT `src/components/beacon/BeaconChatWidget.tsx` (pre-check + capture + post-response invoke)
- EDIT `supabase/functions/beacon-proxy/index.ts` (return `bug_id`)
- EDIT `src/services/beaconApi.ts` (add `bug_id` to type)
- EDIT `src/components/helpdesk/BugFixDashboard.tsx` (Auto-captured badge — small)
- INSERT two `feature_requests` roadmap rows + one `changelog_entries` row
