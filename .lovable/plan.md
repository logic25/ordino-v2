
# Chat Page: Instant Loading + Name Resolution Fix

## Problem Summary

**Two root causes identified from server logs:**

1. **Name resolution is broken** -- The `resolveUserName` function uses `sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE` on the People API `people.get` endpoint, but that source type is only valid for `searchDirectoryPeople`. Every single People API call returns a **400 error**, meaning no human names are resolved, the `isMe` check always fails (because `currentUserDisplayName` is null), and the first member (the current user) is shown as the DM title.

2. **Slow loading** -- Every page load hits the Google Chat API + does 21+ People API calls (all failing). The server-side cache exists but only helps on repeat visits within 5 minutes. First load is always slow.

---

## Plan

### 1. Fix Name Resolution (Edge Function)

**Root cause**: The `resolveUserName` function and the `people/me` call are both using invalid `sources` parameters for the People API `get` endpoint.

**Fix**:
- Remove the broken People API `resolveUserName` calls entirely for DM name resolution
- Instead, use the **Chat API membership data** which already includes `member.displayName` for both humans and bots
- Get the current user's `display_name` from the `profiles` table (already queried) instead of the unreliable `people/me` call
- Pass `profile.display_name` into `enrichSpaceNames` for reliable `isMe` matching
- For bot DMs, use `member.displayName` directly (e.g., "Beacon", "Google Drive")

Changes in `supabase/functions/google-chat-api/index.ts`:
- Add `display_name` to the profile SELECT query
- Rewrite `enrichSpaceNames` to accept `currentUserDisplayName` as a parameter (from the profile)
- Remove the `people/me` call inside `enrichSpaceNames`
- In `resolveMember`, use `member.displayName` from the Chat API membership response directly (skip People API)
- Only fall back to People API with **corrected** source types (`READ_SOURCE_TYPE_PROFILE`, `READ_SOURCE_TYPE_CONTACT`) if `member.displayName` is missing

### 2. Stale-While-Revalidate Caching (Client + DB)

**Strategy**: Show cached data instantly, refresh in background.

**Database changes**:
- Add RLS policy on `gchat_spaces_cache` allowing users to read their own cached data (currently only service role has access)

**Client-side changes** in `src/hooks/useGoogleChat.ts`:
- Add a new `useGChatCachedSpaces` query that reads directly from `gchat_spaces_cache` via Supabase client (instant, no edge function)
- Modify `useGChatSpaces` to:
  - Return cached data immediately on first render
  - Fire the edge function in the background to refresh
  - When the edge function returns, merge/update the React Query cache
  - Only trigger background refresh if cache is older than 5 minutes

### 3. Fix Bot Message Sender Names

In the edge function's `list_messages` handler:
- The member lookup for bot senders already works via the membership fetch
- Ensure bot members with `type: "BOT"` have their `displayName` propagated to messages correctly (the current code skips bots when checking `msg.sender.type !== "BOT"` in the unknown sender resolution loop, but it should still apply the memberMap lookup)

### 4. Clear Stale Cache

After deploying the fix, clear the existing cached data so the corrected name resolution takes effect immediately.

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/google-chat-api/index.ts` | Fix `enrichSpaceNames` to use profile display name for `isMe`, use Chat API member names directly, fix People API source types as fallback |
| `src/hooks/useGoogleChat.ts` | Add stale-while-revalidate pattern: read from cache table first, background refresh via edge function |
| Migration SQL | Add RLS policy for authenticated users to SELECT their own rows from `gchat_spaces_cache` |

### Architecture (Stale-While-Revalidate Flow)

```text
Page Load
    |
    v
[1] Read gchat_spaces_cache from DB  -->  Instant UI render
    |
    v
[2] Check cache age (cached_at)
    |
    +--> Fresh (< 5 min): Done, no background fetch
    |
    +--> Stale (>= 5 min): Fire edge function in background
                              |
                              v
                        [3] Edge function fetches from Google,
                            enriches names, updates cache
                              |
                              v
                        [4] React Query cache updates,
                            UI re-renders silently
```
