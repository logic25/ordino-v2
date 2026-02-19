
## Add Apple Sign-In Button to Login Page

### What changes

One file: `src/pages/Auth.tsx`

An Apple sign-in button will be added directly below the Google button, before the "or continue with email" divider. The `lovable.auth.signInWithOAuth("apple", ...)` function is already available through the existing `lovable` integration — no new packages needed.

### New layout order (inside the sign-in/sign-up form section)

```text
[ Continue with Google  ]
[ Continue with Apple   ]  ← NEW
----or continue with email----
[ Email field          ]
[ Password field       ]
[ Sign In button       ]
```

### Technical details

In `src/pages/Auth.tsx`, after the closing `</Button>` tag for Google (line ~419), insert a new Apple button block with:

- Same `variant="outline"` and `h-11` height to match Google button styling
- Apple SVG logo in black (standard Apple branding)
- Calls `lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin })`
- Same error toast handling as Google button
- Shares the existing `isLoading` state

Also add `prompt: "select_account"` as an `extraParam` to the **Google** button to fix the cached-account issue your partner hit — this forces Google to always show the account picker instead of auto-signing in with a cached account.

### Google button fix (same file)

```typescript
const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin,
  extraParams: {
    prompt: "select_account",
  },
});
```

This means your partner (and all future users) will always be shown the Google account chooser, preventing the wrong-account auto-login situation entirely — no incognito needed.

### Pre-requisite (you do this in the Cloud panel, no code)

Before testing Apple sign-in, in the Authentication Settings panel click **Apple** and toggle it **Enabled**. Lovable Cloud manages the Apple credentials automatically — nothing else needed.
