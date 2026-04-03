

# Fix: Beacon Not Detecting Current Page + Chris's Walkthrough Plan

## Problem
Beacon correctly detects the page (via `useLocation`) and the proxy injects it into a `system_context` field. But the Railway Beacon API likely ignores `system_context` — it's not part of its expected payload. So Beacon responds with "I don't have information about what page you're currently viewing."

## Fix: Inject Page Context Into the Message Itself

Instead of relying on a separate `system_context` field that the external Beacon API may not read, prepend the page context directly into the `message` field that Beacon definitely processes.

### File: `supabase/functions/beacon-proxy/index.ts`

**Current approach** (lines 88-96): Adds page/error info to `body.system_context`

**New approach**: Prepend a context line directly into `body.message`:

```
[User is on the "Settings" page in Ordino]
<original message>
```

This guarantees the LLM sees the page context regardless of how the Railway API structures its prompt. Keep the `system_context` injection as a fallback, but also inject into the message.

### Changes (~lines 88-96):
- After detecting `currentPage`, prepend `[User is on the "${currentPage}" page in Ordino]` to `body.message`
- If `recentErrors` exist, append them as `[Recent errors: ...]` after the page line
- Keep existing `system_context` injection as-is (belt and suspenders)

### File: `src/components/beacon/BeaconChatWidget.tsx`

No changes needed — `currentPage` detection and `contextWithPage` injection already work correctly. The enriched query at line 419 already includes context, but only when `activeContext` has project data. We should also prepend the page name when there's NO project context (e.g., on Settings page).

**Change** (~line 389-420): When building `enrichedQuery`, always prepend `[Page: ${currentPage}]` even when there's no `activeContext`, so Beacon always knows the page.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/beacon-proxy/index.ts` | Inject page context into `body.message` directly, not just `system_context` |
| `src/components/beacon/BeaconChatWidget.tsx` | Always prepend `[Page: currentPage]` to the query, even without project context |

This is a small, targeted fix — two files, ~10 lines changed total.

