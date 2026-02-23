

# Fix: Gmail/Chat OAuth Token Flow

## Problem Diagnosis

There are **two separate Google OAuth flows** in the app that are conflicting:

1. **Sign-in flow** (Auth.tsx): Uses `supabase.auth.signInWithOAuth()` which goes through Lovable Cloud's managed Google OAuth. Even though custom scopes (Gmail, Chat) are requested in the code, the managed OAuth provider likely strips them, so the `provider_token` returned only has basic profile scopes.

2. **Gmail connect flow** (gmail-auth edge function): Uses `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` directly with Google's OAuth endpoint. This correctly requests Gmail + Chat scopes and exchanges the authorization code for proper tokens.

The AuthCallback page tries to take the provider_token from flow #1 and store it as the Gmail connection token. But this token doesn't have Gmail/Chat scopes, so it's useless. Worse, it creates/updates a `gmail_connections` row with an invalid token.

Then when the user visits the Emails page, the gate check (`!gmailConnection`) sees the existing row and skips the "Connect Gmail" screen -- but the token has no Gmail/Chat permissions.

## Fix (3 changes)

### 1. Stop AuthCallback from storing provider tokens for Gmail

Remove the `store_provider_tokens` call from AuthCallback.tsx. The sign-in flow should only handle authentication, not Gmail connection. Gmail/Chat tokens should only come from the dedicated `gmail-auth` flow.

### 2. Fix the Gmail connection gate check

In Emails.tsx (and useGmailConnection), the "is connected" check should verify the connection has a valid `refresh_token`, not just that a database row exists. Change the gate to:

```
if (!gmailLoading && (!gmailConnection || !gmailConnection.refresh_token))
```

This ensures users with stale/empty connections see the "Connect Gmail" screen.

### 3. Fix the Chat reconnect flow to also work from the gate

The "Reconnect Google Account" button in ChatPanel.tsx already uses the correct flow (gmail-auth get_auth_url with redirect to /emails). This is fine. But the Emails page needs to properly handle the `?code=` callback even when in the "gate" state (currently it does via useEffect, but we should make sure the gate doesn't block it).

## Technical Details

**Files to modify:**
- `src/pages/AuthCallback.tsx` -- Remove the `storeProviderTokens` function and all related token capture logic. Keep it as a simple redirect-to-dashboard handler.
- `src/pages/Emails.tsx` -- Update the gate condition to check `!gmailConnection?.refresh_token`. Move the OAuth code-exchange `useEffect` above the gate so it always runs.
- `src/components/chat/ChatPanel.tsx` -- No changes needed; the reconnect flow is already correct.

**Database cleanup:**
- Clear the stale `gmail_connections` row that has null tokens (already done previously, but will happen naturally now since the gate will show "Connect Gmail" for empty rows).

