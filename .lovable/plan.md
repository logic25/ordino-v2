

# Codebase Stabilization Plan

Fixing all 15 issues from the audit. Grouped into 4 phases by risk/effort. Each phase is independently shippable.

## Phase 1 — Quick wins (delete dead code, dedupe)

1. **Delete stub `QuickTimeLog`** — remove `src/components/dashboard/QuickTimeLog.tsx` (the fake one with `// TODO` + `console.log`). Update any dashboard imports to point at `src/components/time/QuickTimeLog.tsx` (the real one).
2. **Delete `src/components/ui/use-toast.ts`** shim. Update any imports to `@/hooks/use-toast`.
3. **Delete walkthrough/welcome cruft** that isn't wired to value:
   - `src/pages/Welcome.tsx` (recently created, not used)
   - Audit `WalkthroughProvider` + `walkthroughs.ts` usage — keep only if PM dashboard tour is in active use; otherwise remove. Will confirm before deleting.
4. **Strip remaining `console.log`** in src/ (3 left).

## Phase 2 — Auth hardening

5. **`src/hooks/useAuth.tsx` rewrite**:
   - Remove IP geolocation `fetch` to `api.ipify.org` (privacy + reliability risk). Insert attendance row without `ip_address` or move to edge function.
   - Replace `(supabase as any)` casts with typed queries.
   - Remove `effectiveHasProfile` sign-out lie — handle Setup-flash via a dedicated `signingOut` guard at the router level instead.
   - Properly surface profile-fetch errors instead of swallowing.
   - Filter profile query by `user_id` (already does) and use `.maybeSingle()` (already does) — align with memory rule.

## Phase 3 — Consolidation

6. **Unify email HTML builders** — create `src/lib/email/buildEmailHtml.ts` with a single `buildEmailHtml({ brand, subject, bodyHtml, footer, attachments })` API. Migrate:
   - `src/lib/buildBrandedEmailHtml.ts`
   - `src/components/proposals/buildProposalEmailHtml.ts`
   - `src/components/rfps/buildRfpEmailBody.ts`
   - `src/components/projects/buildChangeOrderEmailHtml.ts`
   - `src/components/rfps/buildPartnerEmailTemplate.ts`
   Each becomes a thin wrapper that calls the shared builder with template-specific slots. Edge functions get a Deno-compatible copy at `supabase/functions/_shared/buildEmailHtml.ts`.

7. **Edge function `_shared/` lib** — create `supabase/functions/_shared/` with:
   - `cors.ts`, `supabaseClient.ts`, `auth.ts` (JWT verify), `buildEmailHtml.ts`, `gmailSend.ts`.
   Refactor the 6 `send-*` mailers and 3 Beacon proxies to use it. Leave the other 40+ functions untouched in this pass.

## Phase 4 — God components & types hygiene

8. **Split god components** (extract sub-components + hooks, no behavior change):
   - `RfiForm.tsx` (1,674) → form sections + `useRfiForm`
   - `EmailTemplateGallery.tsx` (1,656) → list, editor, preview
   - `TeamSettings.tsx` (1,457) → members tab, roles tab, permissions tab
   - `RfpBuilderDialog.tsx` (1,101) → steps already exist conceptually; extract attachments step (also adds a regression test for the Chris Henry bug)
   - `Proposals.tsx` (994) → table + filters + bulk-actions
   - `useProposals.ts` (1,060) → split into `useProposalsList`, `useProposalMutations`, `useProposalContacts`, `useProposalFollowUps` files; kill `as any` casts by using generated types properly.
   - `useProjectDetail.ts` (806) → split queries by tab.

9. **`types.ts` discipline** — add a CI check (or pre-commit note in README) that fails if `src/integrations/supabase/types.ts` is hand-edited. Document regeneration steps. Audit current diffs vs upstream and regenerate clean.

10. **Kill `as any` flood** — sweep top 10 files (useProposals, useProjectDetail, useAuth, RfpBuilderDialog, etc.) and replace with proper `Tables<'x'>` types. Acceptance: drop from 173 files to <40.

11. **Direct color classes** — replace `text-white`/`bg-black` in the 22 flagged files with semantic tokens (`text-primary-foreground`, `bg-foreground`, etc.). Heaviest: `RfiForm.tsx`, `ClientChangeOrder.tsx`, `BeaconChatWidget.tsx`.

12. **Regression test for RFP attachments** — `src/test/RfpBuilderDialog.attachments.test.tsx` verifying logo + Attachment 6 are toggleable and `selected_attachment_ids` persists.

13. **Migration squash** — collapse the 221 migrations into a single baseline `00000000000000_baseline.sql` + retain the last ~20 incremental ones. Will coordinate timing since this requires DB reset on dev branches.

## Technical Details

- **Backwards compat**: All deletions in Phase 1 are confirmed unused via grep before removal.
- **Tests**: Vitest already configured. Add tests alongside the RFP fix and auth hook changes.
- **No DB schema changes** required for Phases 1–4 (except optional migration squash in #13).
- **Ordering**: Phases ship independently. Within Phase 4, items 8a–8g can be parallelized by component.

## Out of scope

- Rewriting the 40 untouched edge functions (only the mailers + Beacon proxies in this pass).
- Replacing react-query, react-router, or any other library.
- Visual/UX changes — pure refactor + bug-fix work.

## Effort estimate

- Phase 1: ~1 hour
- Phase 2: ~2 hours
- Phase 3: ~4–6 hours
- Phase 4: ~2–3 days (largest chunk is god-component splits)

---

**Confirm to proceed.** If you want to descope (e.g., skip migration squash, skip god-component splits, keep walkthrough), tell me which items to drop and I'll revise.
