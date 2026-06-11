# Reports — admin-only tab gating

## Recommendation

Keep `/reports` accessible to everyone, but hide three tabs from non-admins. These are the only ones that expose company-wide financial/partner/subscription data a PM doesn't need:

- **Referrals** — partner $ rankings, conversion value tiers
- **Data Exports** — bulk CSV dumps of clients, projects, invoices, time
- **CitiSignal** — subscription costs, trial usage, billing exposure

All other tabs (Projects, Billing, Open Services, Service Level, Time, Proposals, Operations) stay visible to staff — PMs already see project $ and billing context elsewhere in the app, so hiding those here would just create friction without adding security.

## Changes

**`src/pages/Reports.tsx`**
- Import `useIsAdmin` from `@/hooks/useIsAdmin`.
- Wrap the three `TabsTrigger` entries (`referrals`, `exports`, `signal`) and their matching `TabsContent` blocks in `{isAdmin && ...}`.
- Non-admins simply don't see the tabs; no route-level redirect needed.

**Changelog**
- Insert one `changelog_entries` row per company describing the access change (per Core memory rule).

## Out of scope

- No RLS changes — Data Exports already pulls via existing hooks/RLS; hiding the UI is sufficient for this pass. If you later want server-side enforcement on the export endpoints, that's a separate task.
- Billing/Proposals tabs stay open to all staff. If you want those admin-only too, say the word and I'll add them.
