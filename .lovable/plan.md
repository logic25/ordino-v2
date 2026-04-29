Full go-live readiness plan — no items deferred. Four parts: domain lockdown, invite system with role pre-assignment, inline role editing in Team settings, and a Manager "personal widgets" toggle.

---

## 1. Lock Google sign-in to `@greenlightexpediting.com`

**Frontend (`src/pages/Auth.tsx`)** — pass Google's `hd` hint so the account picker only shows GLE accounts:
```ts
await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin,
  extraParams: { hd: "greenlightexpediting.com" },
});
```

**Backend (migration on `auto_join_existing_company`)** — real enforcement. Anyone who bypasses the picker still can't create a profile:
```sql
IF (auth.jwt() ->> 'email') NOT ILIKE '%@greenlightexpediting.com' THEN
  RAISE EXCEPTION 'Only @greenlightexpediting.com accounts can join.';
END IF;
```

Existing profiles (Manny, Chris, Mike) are unaffected — the check only runs on first-time profile creation. Failure bounces the user back to `/auth` with the existing toast.

---

## 2. Invite system with pre-assigned roles

So new hires arrive with the right role instead of defaulting to `staff` and waiting for an admin to fix it.

**New table `pending_invites`** (migration):
- `email` (unique, lowercased, must end in `@greenlightexpediting.com`)
- `role` (matches `user_role` enum: `pm`, `manager`, `accounting`, `admin`, `production`, `staff`)
- `first_name`, `last_name` (optional — pre-fill display name)
- `invited_by` (profile id), `company_id`, `expires_at` (default +14 days), `accepted_at`
- RLS: only company admins can `select`/`insert`/`delete`; the consume function reads via `SECURITY DEFINER`.

**Update `auto_join_existing_company`** to consume an invite when one exists:
1. After domain check, look up `pending_invites` by `lower(auth.jwt()->>'email')`, not expired, not accepted.
2. If found: create the profile with `role = invite.role` and the invite's first/last name (overriding what Google sent). Mark invite `accepted_at = now()`.
3. If not found: fall back to current behavior (`role = 'staff'`).
4. Sync to `user_roles` table the same way `sync_profile_role_to_user_roles` does today, so admin invites get the `admin` app_role.

**Settings UI (`src/components/settings/TeamSettings.tsx`)** — add an "Invite Team Member" button that opens a small dialog:
- Email field (validates `@greenlightexpediting.com`)
- First / last name (optional)
- Role dropdown (PM, Manager, Accounting, Admin, Production, Staff) with one-line descriptions
- "Send invite" — writes the row and copies the sign-in link (`https://ordinov3.lovable.app/auth`) to the clipboard. (No email send needed yet — admin pastes the link in Slack/Chat. Email dispatch can be added later by reusing the gmail-send edge function.)
- Pending invites list below with status (pending / accepted / expired) and a "Revoke" button.

---

## 3. Inline role editing + last sign-in in Team settings

So an admin can promote `staff → pm` (or change anyone's role) without touching the database.

In `src/components/settings/TeamSettings.tsx` (or its child team table):
- Replace the static role badge with a `Select` (admin-only). On change: update `profiles.role` and mirror to `user_roles` (insert/delete the matching app_role row, mirroring `sync_profile_role_to_user_roles`).
- Add a "Last sign-in" column sourced from `auth.users.last_sign_in_at`. Since the client SDK can't read `auth.users` directly, expose it via a `SECURITY DEFINER` function `get_team_last_signins(company_id)` that joins `profiles → auth.users` and returns `{user_id, last_sign_in_at}` for company members only.
- Disable the role select for the currently logged-in admin (prevent self-demotion lockout).

---

## 4. Manager "Show personal widgets" toggle

So a player-coach Manager sees team metrics *and* their own queue on one dashboard — no need to give everyone admin just to use the existing role-preview switcher.

**Storage** — reuse `profiles.notification_preferences` JSONB (already used by `useDashboardLayout`). Add key `manager_show_personal_widgets: boolean`. No schema change.

**`src/components/dashboard/ManagerView.tsx`**:
- Add a small toggle in the header row: "Show my personal items" (default OFF).
- When ON, append a section below the existing team charts that renders:
  - `MyActionItemsCard`
  - `RecentProjects` (filtered to current user as PM)
  - `QuickTimeLog`
  - `ProposalFollowUps` filtered to assigned-to-me
- Add the new widgets to `ROLE_WIDGETS.manager` in `src/hooks/useDashboardLayout.ts` so they participate in the existing show/hide config.
- Persist the toggle the same way `useDashboardLayout` writes preferences.

All four widgets already exist — this is composition, no new components.

---

## Sequencing & verification

Order: **1 → 3 → 2 → 4**. (Lockdown first so it's safe to share the link; inline role editing next so admins can fix anyone who already signed in; then invites for new hires; then the Manager polish.)

Verification per part:
1. Sign in with a `@gmail.com` test account → blocked at Setup with the access-denied toast. GLE accounts still work.
2. Create an invite for `test@greenlightexpediting.com` with role `pm` → that user signs in → lands on dashboard with PM view (not staff). Revoke an unused invite → next sign-in falls back to staff.
3. Admin changes a teammate's role from `staff` to `pm` in Settings → Team → that teammate's next page load shows the PM dashboard. Last-sign-in column populated.
4. Toggle ON in Manager view → personal widgets appear below team charts and persist on reload.

## Technical details
- Files touched: `src/pages/Auth.tsx`, `src/components/dashboard/ManagerView.tsx`, `src/hooks/useDashboardLayout.ts`, `src/components/settings/TeamSettings.tsx` (+ a small new `InviteMemberDialog.tsx`), plus migrations for `auto_join_existing_company`, the new `pending_invites` table with RLS, and `get_team_last_signins`.
- Risk: low. Domain check only fires on first-time sign-in; invite consumption falls back to current behavior; role edits are admin-gated with self-demotion protection.