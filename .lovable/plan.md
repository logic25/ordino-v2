

# Launch Blockers — Implementation Plan

Prompt 1 is already done. Here's the plan for the remaining 4.

---

## Prompt 2: Add Sentry Error Monitoring

1. Install `@sentry/react` and `@sentry/vite-plugin`
2. **`src/main.tsx`** — Add `Sentry.init()` before `createRoot()` with the specified config (DSN from env, browser tracing, replay, sample rates, environment)
3. **`src/App.tsx`** — Wrap the `QueryClientProvider` return with `Sentry.ErrorBoundary` using a fallback card component ("Something went wrong" + reload button)
4. Note: `.env` cannot be edited directly (auto-managed), so `VITE_SENTRY_DSN` will need to be added via project settings or left as documentation. Sentry will gracefully no-op if DSN is empty/undefined.

---

## Prompt 3: Remove Console Statements

Strip all `console.log/warn/error` from:
- **`src/hooks/useNYCPropertyLookup.ts`** — ~13 statements (debug logging for GeoSearch/PLUTO lookups)
- **`src/hooks/useActionItems.ts`** — ~7 statements (GChat notification debug logs, error logs for comments/time entries)

No `console` statements found in `src/components/time/QuickTimeLog.tsx` — skip that file.

---

## Prompt 4: Fix npm Vulnerabilities

Lovable cannot run `npm audit fix` directly. Instead:
- Update vulnerable dependencies in `package.json` to latest compatible versions where possible
- Note: Most vulnerabilities (rollup, glob, minimatch) are transitive dev dependencies from Vite/build tooling and may not be directly patchable via `package.json`. Will update what's controllable.

---

## Prompt 5: Edge Function JWT Auth Audit

Categorize all 44 edge functions:

**PUBLIC (no auth needed):** `receive-lead`, `public-co`, `rfp-partner-response`, `pis-contact-search`, `process-deposit-payment` (token-validated already)

**SCHEDULED/INTERNAL (add service-role-key check):** `check-completion-reminders`, `process-billing-schedules`, `process-email-reminders`, `send-billing-digest`, `send-billing-notification`, `auto-checklist-followups`, `process-scheduled-emails`, `send-open-services-report`, `monitor-rfps`, `process-automation-rules`, `send-welcome-email`, `send-gchat-action-item`

**Already has auth:** `beacon-analytics` (x-beacon-key check), `beacon-proxy` (JWT check)

**CLIENT-CALLED (add JWT via getClaims):** `backfill-property-bbl`, `gmail-auth`, `gmail-sync`, `gmail-attachments`, `gmail-search`, `gmail-send`, `google-calendar-sync`, `google-chat-api`, `gchat-interaction`, `analyze-client-payments`, `predict-payment-risk`, `generate-collection-message`, `extract-tasks`, `generate-claimflow-package`, `extract-rfp`, `generate-rfp-cover-letter`, `analyze-plans`, `draft-checklist-followup`, `draft-proposal-followup`, `analyze-telemetry`, `ask-ordino`, `filing-payload`, `filing-status`, `generate-changelog`, `send-bug-alert`

For each client-called function, add at the top of the handler (after CORS):
```typescript
const authHeader = req.headers.get("Authorization");
const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authHeader! } } });
const { data, error } = await supabase.auth.getClaims(authHeader?.replace("Bearer ", "")!);
if (error || !data?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
```

For scheduled/internal functions, add:
```typescript
const authHeader = req.headers.get("Authorization");
if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
```

---

## Execution Order

All 4 prompts will be implemented in sequence. Prompt 5 is the largest (~25 edge functions to modify) but changes are mechanical — same auth pattern inserted at the top of each handler.

