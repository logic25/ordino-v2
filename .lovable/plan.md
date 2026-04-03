

# Beacon Phase 2: Context-Aware Bug Detection + Conversational Bug Reporting

## Summary

Add page/error awareness to Beacon and a conditional "Log as Bug" button that only appears when Beacon's response is actually about a bug — determined by the AI itself via a structured flag in the response, not by naive keyword matching on the user side.

## How "Log as Bug" stays contextual (not noisy)

The beacon-proxy already detects bug-like questions via regex (`isBugQuestion`). We extend this: when the proxy enriches the prompt with bug patterns, it also instructs the AI to include a structured `is_bug_report: true` flag in its JSON response. The widget only renders "Log as Bug" when that flag is present. This means:

- Normal Q&A → no button
- "What's the zoning for this lot?" → no button  
- "Property lookup is broken" + Beacon matches a pattern → button appears
- Console errors detected + user confirms something broke → button appears

## Changes

### 1. `src/services/beaconApi.ts`
- Add `current_page?: string` and `recent_errors?: string[]` to `BeaconProjectContext`
- Add `is_bug_report?: boolean` to `BeaconChatResponse`

### 2. `src/components/beacon/BeaconChatWidget.tsx`
- Import `useLocation`, map pathname to page name
- Add `window.onerror` / `unhandledrejection` listener to capture last 3 errors in a ref
- Pass `current_page` and `recent_errors` in `askBeacon()` context
- Add `is_bug_report` flag to `ChatMessage` interface
- Only show "Log as Bug" button on beacon messages where `is_bug_report === true`
- "Log as Bug" calls beacon-proxy `?action=create-bug` with conversation summary, page, user info

### 3. `supabase/functions/beacon-proxy/index.ts`
- When `isBugQuestion` is true, inject `current_page` and `recent_errors` from `body.project_context` into the system context
- Add instruction to the AI: "If this is a genuine bug/error report, include `is_bug_report: true` in your response metadata"
- Parse the AI response to extract the flag and pass it through
- New action `create-bug`: proxies to beacon-data-proxy's `create_bug_from_conversation`

### 4. `supabase/functions/beacon-data-proxy/index.ts`
- New action: `create_bug_from_conversation`
- Inserts into `feature_requests` with `category = 'bug_report'`
- Triggers `triage-bug-report` function for auto-diagnosis
- Returns bug ID

### 5. `supabase/functions/sentry-webhook/index.ts` (new)
- Receives Sentry issue alerts
- Matches against `bug_patterns`
- Inserts proactive message into `widget_messages` for the affected user

## Files

| File | Action |
|------|--------|
| `src/services/beaconApi.ts` | Add context fields + `is_bug_report` flag |
| `src/components/beacon/BeaconChatWidget.tsx` | Page tracking, error capture, conditional "Log as Bug" |
| `supabase/functions/beacon-proxy/index.ts` | Context injection, `create-bug` action, flag extraction |
| `supabase/functions/beacon-data-proxy/index.ts` | `create_bug_from_conversation` action |
| `supabase/functions/sentry-webhook/index.ts` | New — proactive error detection |

