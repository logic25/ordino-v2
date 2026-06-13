## Goal
Route Ask Ordino panel free-text questions through `askBeacon` (the floating Beacon widget's brain) so there's one AI. Keep `/readiness` on `beacon-readiness-check`. Leave the `ask-ordino` edge function deployed but idle.

## Single change: rewrite `src/hooks/useAskOrdino.ts`

- Add imports: `useAuth` from `@/hooks/useAuth`, `useLocation` from `react-router-dom`, and `askBeacon` + `BeaconProjectContext` from `@/services/beaconApi`.
- Resolve identity inside the hook (matching `BeaconChatWidget`):
  - `userId = user?.email || user?.id || "anonymous"`
  - `userName = profile?.display_name || profile?.first_name || user?.user_metadata?.full_name || "User"`
- Build minimal `BeaconProjectContext` from `location.pathname`:
  - Always set `currentPage: location.pathname`
  - If URL matches `/projects/:uuid`, set `projectId`
- Pass last 5 messages as `conversation_history` (`{ role, content }`).
- Replace the `supabase.functions.invoke("ask-ordino", …)` call with:
  ```ts
  const res = await askBeacon(
    question, userId, userName, projectContext, history,
    { companyId: profile?.company_id ?? null, jurisdiction: "NYC" }
  );
  ```
- Render `res.response`. If `res.sources?.length`, append:
  ```
  
  ---
  **Sources:**
  - {title}
  - {title}
  - {title}
  ```
  (top 3 by array order).
- `/readiness` branch: drop the extra `supabase.from("profiles")` lookup and read `profile.company_id` from `useAuth`. Everything else in that branch is unchanged.
- Preserve all existing error handling verbatim: 429 → "Rate limited" toast, 402 → "Credits exhausted" toast, friendly fallback messages for 503 / rate / unavailable. (The "column does not exist" fallback can stay or be dropped — it's now unreachable since Beacon doesn't expose schema errors; keeping it is harmless.)
- Update `useCallback` deps to include `user`, `profile`, `location.pathname` alongside `messages`.

## Not touched
- `ask-ordino` edge function (`supabase/functions/ask-ordino/` and its `config.toml` entry) — stays deployed, just stops being called.
- `BeaconChatWidget`, AI Usage dashboard, `beacon-readiness-check`.
- Other `ai_usage_logs` writers (`draft-proposal-followup`, `analyze-telemetry`, `analyze-plans`, `generate-collection-message`).
- `AskOrdinoPanel.tsx` / `AskOrdinoButton.tsx` — no prop/contract changes.

## Net effect
Ask Ordino panel now answers both knowledge questions ("what does the code say") and ops questions ("what's overdue this week") via Beacon's existing tools (`query_projects`, `query_invoices`, `query_pm_workload`, etc.). The "Ordino AI" usage tab will flatten over time, confirming `ask-ordino` is safe to delete in a future pass.
