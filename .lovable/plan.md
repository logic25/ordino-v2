# Simplified Proposal Status Lifecycle

## Current Problem

The "Sign & Send" workflow is a single action — the firm signs, then immediately sends. A proposal can never be "sent but not signed." Having both `sent` and `signed_internal` as separate statuses creates confusion and bugs.

## New Lifecycle

```text
draft  -->  sent  -->  executed  -->  (project created)
              |
              v
         lost / expired
```


| Status     | Meaning                                 | Badge Display                                      |
| ---------- | --------------------------------------- | -------------------------------------------------- |
| `draft`    | Created, not yet signed or sent         | Gray "Draft"                                       |
| `sent`     | Signed internally AND emailed to client | Blue "Sent" (awaiting client signature)            |
| `viewed`   | Client opened the proposal link         | Amber "Viewed"                                     |
| `executed` | Fully signed by both parties            | Project Number badge only (e.g. PJ2026-0042) GREEN |
| `lost`     | Manually marked lost                    | Red "Lost"                                         |
| `expired`  | Past validity date                      | Gray "Expired"                                     |


The key change: `signed_internal` is removed entirely. The "Sign & Send" action sets the status directly to `sent` (since signing always happens before sending). `accepted` and `signed_client` are consolidated into `executed`.

## What Changes

### 1. Database Migration

- Update existing rows: `signed_internal` to `sent`, `accepted` to `executed`, `signed_client` to `executed`
- Update the enum/check constraint if one exists

### 2. Sign & Send Flow (src/hooks/useProposals.ts)

- `useSignProposalInternal` sets status to `sent` instead of `signed_internal`
- `useSendProposal` no longer needs the status-check workaround — it just updates `sent_at`
- `useMarkProposalApproved` sets status to `executed` instead of `accepted`

### 3. Status Badges (src/components/proposals/ProposalTable.tsx)

- Remove `signed_internal`, `signed_client`, `accepted` from `STATUS_STYLES`
- Add `executed` — but for executed proposals with a project number, show ONLY the project number badge (no status text)
- For executed proposals without a project number yet, show a green "Executed" badge

### 4. Menu Actions (src/components/proposals/ProposalTable.tsx)

- "Sign & Send" shows for `draft` and `viewed` only
- "Resend to Client" shows for `sent` only
- "Mark as Approved" shows for `sent` and `viewed`
- "Mark as Lost" shows for `draft`, `sent`, `viewed`

### 5. Filter Tabs (src/pages/Proposals.tsx)

- "Sent" tab covers `sent` and `viewed` (no more `signed_internal`/`signed_client`)
- "Accepted" tab renamed to "Executed" covering `executed`
- Update stat counts accordingly

### 6. Client-Facing Components

- `src/pages/ClientProposal.tsx` — client signing sets status to `executed`
- `src/components/clients/ClientProposalsModal.tsx` — update badge map
- `src/components/clients/ClientDetailSheet.tsx` — update variant map

### 7. Follow-up Trigger (if referencing old statuses in database)

- Update any SQL triggers that reference `signed_internal` or `accepted`

## Files Affected

- `src/hooks/useProposals.ts` — sign/send/approve mutations
- `src/components/proposals/ProposalTable.tsx` — badges, menu actions
- `src/pages/Proposals.tsx` — filter tabs, stats, mock data
- `src/pages/ClientProposal.tsx` — client signing status
- `src/components/clients/ClientProposalsModal.tsx` — badge styles
- `src/components/clients/ClientDetailSheet.tsx` — variant map
- New database migration to rename existing status values