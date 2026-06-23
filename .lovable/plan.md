## Goal
Park the "Beacon Lead-to-Proposal Agent" spec as a single `roadmap_items` row so it's visible in the internal roadmap UI and not lost. No code or UI changes.

## Action
One `INSERT` into `public.roadmap_items` via the data tool (not a migration — this is data, not schema).

| Field | Value |
|---|---|
| company_id | `01993413-d3e8-4377-9e21-70f270f04487` (Green Light Expediting LLC) |
| title | `Beacon Lead-to-Proposal Agent` |
| category | `beacon` |
| status | `gap` (default — "parked / not yet started") |
| priority | `medium` |
| sort_order | `0` |
| description | Full spec from the request, formatted as below |

### Description body
```
What it does
A Beacon-powered agent that takes inbound website leads (received by email), automatically researches them — property/DOB lookups (BIN/BBL, zoning, existing filings), client/company context — and drafts a proposal (scope + pricing) for a human to review. The PM/Manny reviews, edits, and approves before anything is sent. It never auto-sends; it turns a cold lead into a reviewable first draft, cutting research + blank-page time on every new lead.

Why
New leads currently require manual research and a from-scratch proposal. This compresses "lead in → draft ready to review" from hours to minutes, so the team spends its time on judgment and the client relationship, not data gathering and boilerplate.

Human-in-the-loop (required)
The agent only prepares — a person approves scope, pricing, and the send. High-stakes, client-facing, so it's review-gated by design.

Status
Future / parked until prerequisites met.

Depends on
- Beacon hardened/trusted — must reliably ground answers and cite sources before drafting client-facing work.
- Scoping/pricing playbook captured — the draft is only as good as the documented logic for how GLE scopes and prices; that judgment isn't written down yet.

Builds on
BD lead intake, NYC property/DOB lookups, proposal creation, and the proposal-AI functions (cover-letter / follow-up drafting) already in Ordino — this orchestrates them into one lead → research → draft → review flow.
```

## Not doing
- No schema migration.
- No new UI, hook, or component.
- No `feature_requests` / `beacon_feedback` / markdown-doc duplicates (you picked roadmap-only).

## Acceptance
- A single new row exists in `roadmap_items` for Green Light Expediting LLC with `title = "Beacon Lead-to-Proposal Agent"`, `category = "beacon"`, `status = "gap"`, `priority = "medium"`, and the full description above.
- Appears wherever the existing roadmap UI reads from `roadmap_items` (no new surface added).
