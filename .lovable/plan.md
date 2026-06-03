
# Plan: Service-tagged notes + email-aware weekly AI digest

## Part 1 — Notes get an optional Service tag (Option C)

### Database
- Add `service_id uuid null` to `public.project_notes`, FK → `services.id` on delete set null.
- Index on `(project_id, service_id, created_at desc)` for filtered feeds.
- No RLS changes — existing project-scoped policies cover it.

### NotesTab UI (`src/components/projects/tabs/NotesTab.tsx`)
- Composer: textarea + small **Service (optional)** dropdown listing this project's services (defaults to `General`).
- Each note row shows a badge: `General` (gray) or `PAA1 — Sprinkler` (colored).
- Filter chips above the feed: `All · General · <each service>` — client-side filter.
- Delete + AI summary buttons unchanged. AI summaries always save as `General`.

### OOO handoff
- Include service tag inline in the latest-notes formatter: `[PAA1 — Sprinkler] examiner objections received 3d ago`.

### Litigation package
- Out of scope (your call). Keeps current chronological behavior.

---

## Part 2 — Weekly AI digest: scope, cost, and email awareness

The job lives at `supabase/functions/weekly-project-digest/index.ts` and already runs Sunday nights via pg_cron, calling `summarize-project` per project.

### Open projects only — already correct
Query filters `.eq("status", "open")`. Closed / executed / archived projects are skipped. No change needed.

### Email thread bodies — adding them now
Today the summarizer only sees email *metadata* via the `activities` table (subject lines on `email_received` / `email_sent` rows). You want body context for real awareness — fair.

**Change in `summarize-project/index.ts`:**
1. After loading the project, query `email_project_tags` joined to `emails` for that project, last 30 days, limit 10 most recent.
2. For each, include: `from_name`, `from_email`, `date`, `subject`, and a **trimmed body** — prefer `snippet` (Gmail's ~200-char preview, already in the row, no extra cost), and pull `body_text` truncated to ~600 chars for the **3 most recent** threads only (where context matters most).
3. Strip quoted reply chains (`On <date>, <person> wrote:` and lines starting with `>`) before truncation so we don't waste tokens on duplicated history.
4. Pass under `recent_emails` in the JSON context. Update the system prompt: *"Recent client/agency emails are included — reference what was said when it explains the current status or blocker."*

Result: summaries can say things like *"Examiner Garcia replied Tuesday rejecting the sprinkler stamp; PM hasn't responded yet"* instead of just *"email received."*

### Cost at 1,000 open projects per week
Per project, new prompt size:
- Project meta + services + notes + activities: ~3K tokens (unchanged)
- 10 email metas (snippet only): ~600 tokens
- 3 trimmed bodies (~600 chars ≈ 200 tokens each): ~600 tokens
- **Total input: ~4–5K tokens. Output: ~250 tokens.**

Model is `google/gemini-2.5-flash` (cheapest reasoning-tier on Lovable AI). At current pricing this is **fractions of a cent per project**, so **~$10–25/month** for a weekly run over 1,000 projects.

Pacer is 250 ms between calls → 1,000 projects ≈ 4–5 min wall clock, sequential to respect rate limits.

Two levers if it ever creeps up:
1. Drop to `gemini-2.5-flash-lite` (~3× cheaper, fine for status blurbs).
2. Skip projects with **zero activity in last 30 days** (no notes, no activities, no emails) — saves 30–50% of calls in practice. Easy add later.

Ship as-is; revisit only if usage actually spikes.

---

## Out of scope
- Litigation grouping by service.
- Per-service notes sub-tab inside service detail (the optional tag handles it).
- Ingesting *all* emails (untagged) — we only read emails already linked to the project via `email_project_tags`, which respects what your team has curated.

## Result
- Team can quick-tag any note to a service when it matters, ignore it for general updates.
- Weekly digest is scoped to open projects, costs ~$10–25/mo at 1K projects, and now reads tagged email bodies so the AI knows what clients/agencies actually said — not just that mail arrived.
