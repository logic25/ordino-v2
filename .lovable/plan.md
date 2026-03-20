

# Plan: Fixes 8–14

## Summary

Seven targeted fixes across frontend components, edge functions, and a data hook. One fix (Property not-found state) is already implemented and will be skipped.

---

## Fix 8: Beacon Error Handling
**File:** `src/components/chat/ChatPanel.tsx`

Add a visible error message in the `sendBeaconDirectMessage` catch block. After `console.error`, insert a bot error message into widget_messages so it appears in the chat, then invalidate the query to show it.

## Fix 9: ProjectDetail Performance
**File:** `src/pages/ProjectDetail.tsx`

Replace `useProjects()` (fetches ALL projects) with the existing `useProject(id)` hook from `src/hooks/useProjects.ts`. Change line 128 from `const { data: projects = [], isLoading } = useProjects()` to `const { data: project, isLoading } = useProject(id)` and remove the `.find()` on line 140.

## Fix 10: Property Detail Not Found — ALREADY DONE
**File:** `src/pages/PropertyDetail.tsx`

Lines 212-222 already show "Property not found" with a back button. No changes needed.

## Fix 11: DOB NOW PAA Dedup
**File:** `src/hooks/useDOBApplications.ts`

For DOB_NOW_BUILD records where `docNum` is null, use the full `job_filing_number` (which includes filing-specific suffixes) as the dedup key instead of defaulting to `"01"`. Change line 246:
```
const key = r.source === "DOB_NOW_BUILD" && !r.docNum
  ? `NOW-${r.jobNum}`
  : `${jobDigits}-${r.docNum || "01"}`;
```

## Fix 12: Blank Invoice Numbers
**File:** `supabase/functions/process-billing-schedules/index.ts`

The `invoices` table has a `generate_invoice_number()` trigger that fires on INSERT and sets `invoice_number` when it's NULL or empty. The current code sets `invoice_number: ""` which the trigger checks for. The trigger already handles this — but the empty string `""` passes the `IS NULL OR = ''` check in the trigger. Verify trigger logic handles empty string. The trigger at line `IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN` does handle it. So the fix is simply to pass `null` instead of `""` to be explicit and let the trigger do its job.

## Fix 13: AI JSON Parsing Silent Failures
**Files:** Edge functions that parse AI JSON responses and silently return defaults on failure.

Key files to update:
- `supabase/functions/extract-tasks/index.ts` — returns empty `{ tasks: [], promises: [] }` on parse failure
- `supabase/functions/predict-payment-risk/index.ts` — falls back to defaults
- `supabase/functions/analyze-telemetry/index.ts` — falls back to empty array
- `supabase/functions/generate-collection-message/index.ts` — falls back to defaults

For each: log the raw AI response, add a `warning` field to the response JSON when falling back. No HTTP status change needed — just add `warning: "AI response could not be parsed, showing defaults"` to the response body.

Frontend: No universal toast needed — each caller can check for `warning` field. This is a low-priority enhancement; will add the `warning` field server-side only.

## Fix 14: Auth Callback Timeout
**File:** `src/pages/AuthCallback.tsx`

Replace the silent redirect with a stateful timeout message. Add a `timedOut` state. When the 10s timeout fires, set `timedOut = true` instead of navigating. Render a message with a link to `/auth` instead of `<LoadingScreen />`.

---

## Files Changed

| File | Fix |
|------|-----|
| `src/components/chat/ChatPanel.tsx` | #8 |
| `src/pages/ProjectDetail.tsx` | #9 |
| `src/hooks/useDOBApplications.ts` | #11 |
| `supabase/functions/process-billing-schedules/index.ts` | #12 |
| `supabase/functions/extract-tasks/index.ts` | #13 |
| `supabase/functions/predict-payment-risk/index.ts` | #13 |
| `supabase/functions/analyze-telemetry/index.ts` | #13 |
| `supabase/functions/generate-collection-message/index.ts` | #13 |
| `src/pages/AuthCallback.tsx` | #14 |

No database migrations required. No new dependencies.

