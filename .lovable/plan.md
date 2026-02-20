
# Unified Google-Only Login + Auto Gmail Connection

## Goal

Replace the current two-step process (sign in → separately connect Gmail) with a single flow: clicking "Continue with Google" logs the user in AND connects their Gmail inbox simultaneously, using your own Google Cloud credentials (`GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`).

## Why This Works End-to-End

Your Google Cloud project already has:
- `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` stored as secrets
- The `gmail-auth` edge function using those credentials to do the Gmail OAuth flow

The plan switches the login button to use those same credentials via Supabase's native Google OAuth, requesting Gmail scopes at login time. The `provider_token` (Gmail access token) is returned directly in the session, eliminating the need for a separate Gmail consent screen entirely.

## Manual Step You Need to Do First (One-Time)

Before the code changes are applied, you need to configure the Google Cloud Console. In your **Google Cloud Console → OAuth Client → Authorized redirect URIs**, add this URI:

```
https://mimlfjkisguktiqqkpkm.supabase.co/auth/v1/callback
```

Keep the existing `/emails` URI — it can stay there, it won't conflict. Do NOT remove any existing URIs.

Then in **Lovable Cloud → Authentication Settings → Sign In Methods → Google**, switch from "Managed" to "Custom credentials" and enter your `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

## What Changes in Code

### 1. `src/pages/Auth.tsx` — Strip down to Google-only

- Remove the Apple sign-in button entirely
- Remove the email/password form, the divider, and the "Forgot password" link from the main login view
- The password reset view (`isPasswordReset`) is kept intact and hidden — reachable only via a direct email reset link for any legacy users
- Change the Google button to use `supabase.auth.signInWithOAuth` directly (instead of `lovable.auth.signInWithOAuth`) so we can pass Gmail scopes:

```typescript
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ].join(" "),
    queryParams: {
      prompt: "select_account",
      access_type: "offline",
    },
  },
});
```

### 2. `src/pages/AuthCallback.tsx` — Auto-store Gmail tokens on first login

After the `SIGNED_IN` event fires, check the session for `provider_token` and `provider_refresh_token`. If present (meaning it's a Google login with Gmail scopes granted), call a new edge function action `store_provider_tokens` to save them into `gmail_connections`. This means by the time the user hits the dashboard, Gmail is already wired up.

```typescript
if (event === "SIGNED_IN" && session) {
  if (session.provider_token && session.user.app_metadata.provider === "google") {
    // Silently store Gmail tokens — no extra button needed
    await supabase.functions.invoke("gmail-auth", {
      body: {
        action: "store_provider_tokens",
        access_token: session.provider_token,
        refresh_token: session.provider_refresh_token,
      },
    });
  }
  navigate("/dashboard", { replace: true });
}
```

### 3. `supabase/functions/gmail-auth/index.ts` — Add `store_provider_tokens` action

Add a new action handler that accepts an access token + refresh token directly (already exchanged by Supabase) and upserts them into `gmail_connections` — fetching the Gmail email address using the access token to confirm the correct account.

### 4. `src/pages/Emails.tsx` — Simplify the gate

Since Google login users will always have Gmail connected after their first sign-in, the gate only needs to remain for edge cases. The existing gate UI can stay as-is — it will just be rarely seen.

## What the Login Screen Looks Like After

```text
┌────────────────────────────────────┐
│           Welcome back             │
│  Sign in to access your projects   │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  G   Continue with Google   │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

## Complete User Flow After Implementation

```text
User visits app → /auth
        |
        v
Clicks "Continue with Google"
        |
        v
Google consent screen (your credentials)
Grants: identity + Gmail read/send + Calendar
(Only shown ONCE — auto-approved on future logins)
        |
        v
Redirects to /auth/callback
        |
        v
AuthCallback stores Gmail tokens automatically
        |
        v
User lands on /dashboard
Gmail already connected — inbox ready
```

## Files to Change

- `src/pages/Auth.tsx` — Google-only UI, switch to `supabase.auth.signInWithOAuth` with Gmail scopes
- `src/pages/AuthCallback.tsx` — Auto-store `provider_token` into gmail_connections on login
- `supabase/functions/gmail-auth/index.ts` — Add `store_provider_tokens` action

## Important Note on Existing Users

Any users currently signed in via email/password will not be affected by the UI change — they'll just see the Google-only screen and need to sign in with Google from that point forward. Since this is an internal tool for a Google Workspace team, this is the intended behavior.
