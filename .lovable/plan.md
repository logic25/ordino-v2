## Problem

`InviteClientDialog` picks a **client (company)** and makes you retype email/name. Company-level email is often generic (`info@…`) or missing, and companies don't have first/last names — so invites go to the wrong inbox or arrive with a blank greeting.

Portals are used by **people**. The invite should be built around a **contact**.

## Proposed flow

Two-step picker in the same dialog:

1. **Client (company)** — unchanged dropdown from `clients`. Determines the portal org.
2. **Contact (person)** — new dropdown from `client_contacts` where `client_id = <selected client>`. Selecting a contact auto-fills:
   - `email` ← `contact.email`
   - `first_name` / `last_name` ← split from `contact.name`
   - primary contact pre-selected when present

Escape hatch: **"Invite someone else…"** option at the bottom of the contact dropdown reveals manual email + first/last-name fields.

Behavior:
- Zero contacts on the selected client → manual fields shown directly with hint *"No contacts on file — enter their details."*
- Client-level `clients.email` is no longer auto-filled (source of the generic-email bug). Only a real contact's email pre-fills.
- Send disabled until `clientId` + valid `email`.
- Greeting uses contact's first name; falls back to `"there"`.

## "Invite someone else" persistence

On send, if the invitee came from the manual path, silently upsert into `client_contacts`:

- `client_id` = selected client
- `name` = `"${firstName} ${lastName}".trim()` (or email local-part if both blank)
- `email` = entered email (stored lowercased)
- `is_primary` = **always `false`** (never auto-promote)
- Any other columns left to defaults

**Dedupe:** before insert, query `client_contacts` for `client_id = <selected> AND lower(email) = lower(<entered>)`. If a row exists, skip insert. Scope is **email-within-client only** — same email on a different client creates a new row.

No toast, no confirm dialog. If the insert errors, log and continue — the invite itself still succeeds.

## Files touched

- `src/components/portal/InviteClientDialog.tsx` — add contact dropdown, auto-fill, manual escape hatch, post-send contact upsert.
- Reuse `useClientContacts(clientId)` from `@/hooks/useClients`.

## Out of scope

- No schema changes, no migration, no RLS changes.
- No changes to `client_portal_invites`, `client_orgs` provisioning, edge functions, or sign-in flow.
- No bulk/multi-contact invite.