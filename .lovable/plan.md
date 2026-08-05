## Goal
Clean up the Leads page navigation so each user sees exactly one set of saved-view controls, and make the Follow-ups sidebar item point to its own focused view instead of duplicating the Leads page.

## Verified cause
- The database contains one `All leads`, `My open leads`, and `Hot opportunities` set per user; there are no duplicate rows for the same user.
- Company admins are allowed to read teammates' `lead_views` rows.
- `useLeadViews()` currently fetches every row visible under those policies, and `BdLeads.tsx` renders all returned views without filtering by owner. An admin therefore sees the same three labels once for every teammate.

## Plan
1. Scope `useLeadViews()` to the signed-in user's `user_id` so the page loads only that user's default and custom views.
2. Keep the existing database policies and teammates' saved views unchanged; this is a UI query-scope fix, not data deletion.
3. Make `/bd/follow-ups` render the existing `BdFollowUps.tsx` view (currently built but not routed) so the sidebar item has a distinct purpose: a focused "who do I owe a touch" list with overdue/today/week/later buckets.
4. Remove the redirect that currently sends `/bd/follow-ups` into the Leads page with a query parameter.
5. Verify that:
   - The Leads page shows one set of default views (`All leads`, `My open leads`, `Hot opportunities`).
   - Creating/deleting a personal saved view still works.
   - The Follow-ups sidebar item opens the standalone follow-ups page.
6. Add the required changelog entry describing the duplicate-control fix.

## Technical note
The query will add `.eq("user_id", user.id)` before ordering. This aligns the read path with the existing create/update/delete ownership model.
