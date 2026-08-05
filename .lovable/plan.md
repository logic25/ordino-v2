## Goal
Remove the repeated saved-view controls on the Leads page while preserving each user's personal views.

## Verified cause
- The database contains one `All leads`, `My open leads`, and `Hot opportunities` set per user; there are no duplicate rows for the same user.
- Company admins are allowed to read teammates' `lead_views` rows.
- `useLeadViews()` currently fetches every row visible under those policies, and `BdLeads.tsx` renders all returned views without filtering by owner. An admin therefore sees the same three labels once for every teammate.

## Plan
1. Scope `useLeadViews()` to the signed-in user's `user_id` so the page loads only that user's default and custom views.
2. Keep the existing database policies and teammates' saved views unchanged; this is a UI query-scope fix, not data deletion.
3. Verify that the Leads page shows one set of default views and that creating/deleting a personal saved view still works.
4. Add the required changelog entry describing the duplicate-control fix.

## Technical note
The query will add `.eq("user_id", user.id)` before ordering. This aligns the read path with the existing create/update/delete ownership model.
