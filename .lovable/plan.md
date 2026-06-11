## Weekly Project Digest — tightening + email delivery

### Problem recap
- Cron runs Mondays 11:00 UTC and succeeds, but it only writes in-app notifications — **no email is ever sent**, which is why your inbox is empty.
- Scope is "every open project" — too broad. Stale and quiet projects burn AI calls and clutter the digest.
- Nightly summarizer already regenerates active projects daily, so the weekly run duplicates work.

### Behavior

**Bucketing per open project (computed from last signal across `project_notes`, `project_timeline_events`, `services.updated_at`, `activities`, `emails` tagged to project):**

| Bucket | Last signal | AI summary | Digest treatment |
|---|---|---|---|
| Active | ≤7 days | Reuse if <24h fresh from nightly, else regenerate | Green, full summary |
| Quiet | 8–30 days | **Reuse last summary** (no AI call) | Yellow, "No movement in N days" flag |
| Stale | >30 days | **Regenerate** (so PM sees latest read before action) | Red, "Stale — needs attention or close" flag |

Skip projects that are `archived`, `on_hold`, or have no `assigned_pm_id`.

Per-PM cap of 25 AI regenerations per run; remainder fall back to last summary with a "Skipped — capacity" note.

### Email delivery (the missing piece)

- Send via Lovable Emails (`send-transactional-email`) from `notify@ordinopm.com`.
- New React Email template: `weekly-project-digest.tsx` with three sections (Active / Quiet / Stale), counts in subject, project links.
- Admins (role = admin) get a **company-wide roll-up** version including every PM's projects.
- Idempotency key: `weekly-digest-{user_id}-{YYYY-WW}` so re-runs don't double-send.
- In-app notification still fires alongside the email.

### Settings toggle

`Settings → Notifications → Weekly project digest`:
- ☑ Email me the weekly digest (default on)
- Scope: All my projects / Active only / Active + Stale (default)

Stored on `profiles.notification_preferences.weekly_digest`.

### Observability

- One `automation_logs` row per run: `active_count`, `quiet_count`, `stale_count`, `ai_calls_made`, `ai_calls_skipped`, `emails_sent`, `errors`.
- Email deliverability visible in `email_send_log` (system-wide).

### Files

- **Edit** `supabase/functions/weekly-project-digest/index.ts` — bucket logic, reuse-summary, throttle, email send, automation log
- **New** `supabase/functions/_shared/transactional-email-templates/weekly-project-digest.tsx`
- **Edit** `supabase/functions/_shared/transactional-email-templates/registry.ts` — register template
- **Edit** `src/components/settings/NotificationSettings.tsx` — toggle + scope dropdown
- **Changelog** entry

### AI cost impact

- Today: ~1 AI call per open project per week.
- After: ~1 AI call per active project per week (most active projects reuse nightly's output, so likely 0 new calls) + 1 per stale project. Quiet projects = $0. Net: significant reduction.

### Out of scope (this turn)

- Changing nightly schedule
- Digest archive page in the app
- Per-client / per-PM custom delivery times
- Auto-archiving stale projects (just flagged for now)
