## Issue

The "Pending invites" card in **Settings → Team & Users** queries the `pending_invites` table and shows every row, including ones that have already been accepted. That's why Sai / Don / Natalia / Sheri are all listed there with an "Accepted" badge — they accepted their invites long ago and are already shown in the Team Members table below, so showing them again as "pending" is misleading.

File: `src/components/settings/InviteMemberDialog.tsx`
- Query at lines 52-64 pulls all invites with no status filter.
- `statusOf()` (line 173) tags rows as `accepted` when `accepted_at` is set, but the panel renders them anyway.

## Fix

In `InviteMemberDialog.tsx`:

1. In the `pending-invites` query, filter out accepted rows — either at the DB level (`.is("accepted_at", null)`) or in the component before rendering. DB-level is cleaner and avoids transferring stale rows.
2. Also drop rows whose `expires_at` is more than ~7 days in the past so the list doesn't accumulate stale expired invites forever (still show recently-expired ones so an admin can see and re-send).
3. Keep the existing "Accepted" badge code path for the rare race where a row accepts between fetch and render — no UI removal needed beyond the filter.
4. Card header count and the `invites.length > 0` guard naturally update from the filtered list.

No schema or RLS changes. No other files affected. The Team Members table below already represents accepted users.

## Out of scope

- Renaming the panel, adding tabs for "Accepted history", or building an invite audit log.
- Touching `TeamSettings.tsx` performance/KPI work from the previous turn.
