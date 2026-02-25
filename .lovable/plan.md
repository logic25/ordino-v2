

# Fix @Beacon in Spaces, Improve Sources UI, and Add Thinking Indicator

## Overview
Three code changes plus one infrastructure task to fix the @beacon mention flow, improve source citations, and add a loading indicator for Beacon responses.

---

## Task 1: Redeploy gchat-interaction Edge Function

The `gchat-interaction` edge function needs to be redeployed to ensure it's live and receiving Google Chat webhook events. The code is correct -- it forwards non-task messages to Beacon's `/webhook` endpoint on Railway, which then replies via the Google Chat API.

**Action:** Force a redeploy of `supabase/functions/gchat-interaction/index.ts` (add a trivial comment to trigger deploy), then verify via edge function logs that it's running.

---

## Task 2: Remove Client-Side @Beacon Interception

The `sendBeaconInSpace` function in `ChatPanel.tsx` (lines 172-209) and the `@beacon` detection in `handleSend` (lines 219-223) must be **removed entirely**. This client-side routing calls `/api/chat` which does NOT post replies back to Google Chat, so teammates never see the response. The correct flow goes through the Google Chat webhook to the edge function to Beacon's `/webhook`.

**Changes in `ChatPanel.tsx`:**
- Delete the `sendBeaconInSpace` function (lines 172-209)
- Delete the `@beacon` detection block in `handleSend` (lines 219-223)
- Regular `sendMutation.mutate()` will handle the message -- Google Chat receives it, triggers the bot webhook, which hits our edge function, which forwards to Beacon

---

## Task 3: Make Sources Expandable with chunk_preview

Update `WidgetSources` in `ChatMessageList.tsx` so each individual source item is expandable to show its `chunk_preview` text.

**Changes in `ChatMessageList.tsx`:**
- Add per-source expand/collapse state (track which source indices are expanded)
- Each source row gets a clickable toggle (ChevronRight/ChevronDown)
- When expanded, show the `chunk_preview` text below the source title in a muted, smaller font block
- Keep the existing relevance score bar beside the title

---

## Task 4: Add Thinking/Typing Indicator for Beacon DM

Add a visual "thinking" animation while waiting for a Beacon response in the DM view.

**Changes in `ChatPanel.tsx`:**
- Add `isWaitingForBeacon` state, set `true` at start of `sendBeaconDirectMessage`, set `false` in the `finally` block
- Pass `isWaitingForBeacon` as a prop to `ChatMessageList`

**Changes in `ChatMessageList.tsx`:**
- Accept optional `isWaitingForBeacon` prop
- When true, render a typing indicator bubble at the bottom of the message list (before the scroll anchor)
- Use an animated Brain icon with three bouncing dots styled with CSS keyframes
- The indicator auto-hides when the response arrives (prop becomes false)

---

## Task 5: Manual Verification (Not a Code Change)

Verify in Google Cloud Console that the Ordino bot's App URL is set to:
`https://mimlfjkisguktiqqkpkm.supabase.co/functions/v1/gchat-interaction`

If it points elsewhere (e.g., directly to Railway), that explains why @mentions in spaces don't trigger the bot. This is a manual configuration check.

---

## Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/gchat-interaction/index.ts` | Add comment to force redeploy (no logic change) |
| `src/components/chat/ChatPanel.tsx` | Remove `sendBeaconInSpace` + @beacon detection; add `isWaitingForBeacon` state |
| `src/components/chat/ChatMessageList.tsx` | Expandable sources with chunk_preview; thinking indicator bubble |

