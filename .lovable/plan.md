## Goal
Clients who receive a portal invite should not need a Google or Green Light account. The invite email should take them to a client-specific passwordless sign-in screen where they enter the invited email and receive a magic link.

## Plan
1. **Add a client portal auth route**
   - Add `/portal/auth` as a public route.
   - Show only the client magic-link form there; no Google button, no staff wording.
   - After the email link is clicked, send clients back to `/portal`.

2. **Update invite emails and copied links**
   - Change the invite CTA from `https://ordinopm.com/auth` to `https://ordinopm.com/portal/auth`.
   - Update the email copy so it says “Enter this email to get a secure sign-in link,” instead of implying Google sign-in.

3. **Preserve staff login behavior**
   - Keep `/auth` as the staff login page with Google as the primary option.
   - Keep the existing setup flow that accepts a matching pending client invite and creates the client portal profile/membership.

4. **Verify the flow**
   - Confirm `/portal/auth` renders without Google.
   - Confirm unauthenticated `/portal` access still redirects appropriately.
   - Confirm the magic-link redirect target is `/portal`, so the invite acceptance RPC runs through the existing setup/profile flow if needed.