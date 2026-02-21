

## Smart Proposal Follow-Up System

### Overview

This plan adds **read receipts** when a client opens a proposal link, instant **PM notifications**, and lays the groundwork for **AI-drafted follow-up emails** that get smarter over time as data accumulates.

Follow-up emails will live in two places:
1. **Dashboard "Proposals to Follow Up" card** -- enhanced with a "Draft Follow-up Email" action that uses AI to generate a contextual nudge based on proposal details and timing
2. **Proposal table action menu** -- same "Draft Follow-up Email" option, which opens the Compose Email dialog pre-filled with the AI-generated draft

---

### What Gets Built

**Phase 1: Read Receipts + Notifications (immediate value)**

- When a client opens the proposal link (`/proposal/:token`), automatically set `viewed_at` timestamp and update status to `"viewed"` (only on first view)
- Send an in-app notification to the assigned PM: "Client viewed proposal #MMDDYY-1 for 123 Main St"
- Show a "Viewed" indicator in the proposal table (already has the status style defined)
- Log the view event in `proposal_follow_ups` table for history

**Phase 2: AI-Drafted Follow-Up Emails**

- New backend function `draft-proposal-followup` that takes proposal context (title, amount, days since sent, days since viewed, follow-up count, client name) and generates a professional nudge email
- "Draft Follow-up Email" action in both the dashboard card and the proposal table menu
- Opens the existing Compose Email dialog pre-populated with: To (client email), Subject, and AI-generated body
- The PM can review, edit, and send -- nothing goes out automatically
- Each sent follow-up gets logged, building the data foundation for smart timing later

---

### Where Follow-Up Emails Live

```text
Dashboard                          Proposals Page
+--------------------------+       +---------------------------+
| Proposals to Follow Up   |       |  ... | Actions menu       |
|                          |       |      |  Edit               |
|  "ABC Renovation"        |       |      |  Client Preview     |
|  Viewed 2d ago - $15,000 |       |      |  Draft Follow-up    |
|  [Draft Follow-up Email] |       |      |  Log Follow-up      |
|  [Snooze] [Dismiss]      |       |      |  Snooze             |
+--------------------------+       +---------------------------+
         |                                    |
         +----------> Opens Compose Email <---+
                      pre-filled with AI draft
```

The AI draft is context-aware:
- First follow-up: friendly check-in ("wanted to make sure you received...")
- After client viewed: acknowledges they looked at it ("I noticed you had a chance to review...")
- Multiple follow-ups: more direct ("following up again on...")
- High-value proposals: emphasizes timeline/availability

---

### Technical Details

**1. Client Proposal Page (`src/pages/ClientProposal.tsx`)**
- Add a `useEffect` that fires once when proposal data loads
- Calls `supabase.from("proposals").update({ viewed_at, status: "viewed" })` if `viewed_at` is null and status is `"sent"`
- Creates a notification for the assigned PM
- Logs a "viewed" entry in `proposal_follow_ups`

**2. New Edge Function: `supabase/functions/draft-proposal-followup/index.ts`**
- Accepts `proposal_id`, fetches proposal details from DB
- Calls Lovable AI (Gemini 3 Flash) with proposal context to generate email subject + body
- Returns `{ subject, html_body }` to the frontend
- Handles 429/402 rate limit errors

**3. Dashboard Follow-Ups Card (`src/components/dashboard/ProposalFollowUps.tsx`)**
- Add "Draft Follow-up Email" menu item
- When clicked, calls the edge function, then opens Compose Email dialog with pre-filled data

**4. Proposal Table Menu (`src/components/proposals/ProposalTable.tsx`)**
- Add "Draft Follow-up Email" menu item for sent/viewed proposals
- Same behavior: calls edge function, opens compose dialog

**5. Proposals Page (`src/pages/Proposals.tsx`)**
- Wire up the new "Draft Follow-up" action
- Manage compose dialog state with pre-filled AI content

**6. Update `supabase/config.toml`**
- Add `[functions.draft-proposal-followup]` with `verify_jwt = false`

**Database**: No schema changes needed -- `proposals.viewed_at` column and `proposal_follow_ups` table already exist.
