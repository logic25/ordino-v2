## Two problems, two fixes

### Fix 1 — One-click branded invite (no more double email)

**Today:** invite email → click → `/portal/auth` → type email → Supabase magic-link email → click → in.
**After:** invite email → click → in.

The invite email's CTA will BE the magic link, minted via Supabase Admin API server-side.

**New edge function `send-portal-invite`** (`verify_jwt = true`):
- Input: `{ email, first_name, last_name, org_name, client_org_id }`.
- Verifies caller is GLE staff (`is_gle_staff(auth.uid())`).
- Uses the service-role client to call `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: 'https://ordinopm.com/portal' } })` — this returns an `action_link` **without** Supabase sending its own email.
- Sends the existing Ordino-branded HTML through `gmail-send` (forwarding the caller's `Authorization` header so the send uses the staff Gmail connection) with the CTA button pointing at that `action_link`.
- Returns `{ ok: true }` (or error).

**`InviteClientDialog` changes:**
- Keep the existing local work: find-or-create `client_orgs`, insert `client_portal_invites`, silent contact upsert for manual entries (already shipped).
- Replace the inline `gmail-send` call with `supabase.functions.invoke('send-portal-invite', { body: {...} })`.
- Toast copy: *"Invite sent to <email> — one click and they're in."*
- "Copy sign-in link" button is removed (the link is now per-invite and single-use — a static `/portal/auth` link would just resurrect the old two-step flow).

### Fix 2 — Block uninvited emails at `/portal/auth`

`/portal/auth` becomes the "lost your invite" fallback, not an open door.

**New SECURITY DEFINER RPC `portal_email_has_access(_email text) returns boolean`:**
- Returns true if there's a non-expired, non-accepted row in `client_portal_invites` for `_email`, OR the email is already tied to a `client_org_memberships` row (accepted invites, so they can re-request).
- `GRANT EXECUTE ... TO anon, authenticated` — the page runs unauthenticated.
- Case-insensitive match (lower(email)).

**`MagicLinkForm` (portal path only) changes:**
- Before calling `signInWithOtp`, call `supabase.rpc('portal_email_has_access', { _email })`.
- If false → toast + inline error: *"This email hasn't been invited to the client portal. Ask your project manager to send you an invite."* Nothing sent.
- If true → same `signInWithOtp` as today. This becomes the resend path for lost/expired invite emails.
- Staff path (`/auth`) is unaffected — the check only runs for the portal variant. Add a `requireInvite?: boolean` prop to `MagicLinkForm`, default false, set true from `PortalAuth`.

**`PortalAuth.tsx` copy update:**
> "Already got your invite email? Just click the button in it — one click signs you in.
> Lost it? Enter the invited email and we'll resend the link."

### Out of scope
- No changes to the invite table schema (no token column — magic link IS the token, minted on-demand).
- No changes to `client_orgs`, membership provisioning, staff `/auth` flow, or accepted-invite handling.
- No email-domain / template scaffolding — we keep sending through the existing `gmail-send` function so the invite comes from a real Green Light inbox.
- No bulk/multi-recipient invites.

### Files touched
- `supabase/functions/send-portal-invite/index.ts` (new)
- `supabase/migrations/<new>.sql` — `portal_email_has_access` function + grants
- `src/components/portal/InviteClientDialog.tsx` — swap gmail-send for send-portal-invite; drop "copy link" button; updated toast
- `src/pages/Auth.tsx` — add `requireInvite` prop to `MagicLinkForm`; RPC pre-check
- `src/pages/portal/PortalAuth.tsx` — pass `requireInvite`, updated copy