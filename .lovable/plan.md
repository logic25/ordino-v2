## Batch A — Close the Funnel Loop

### Step 0 — Save doctrine
- Write `mem://doctrine/ordino-master-prompt` with the full master planning prompt.
- Append one-liner to `mem://index.md` Core: "All plans must be evaluated against the Ordino Master Planning Prompt (mem://doctrine/ordino-master-prompt)."

### Step 1 — Atomic lead conversion (Postgres RPC)
- **Migration:**
  - Add `proposals.lead_id uuid references public.leads(id)` (nullable, indexed).
  - Create `public.convert_lead_to_proposal(_lead_id uuid, _proposal_payload jsonb) returns uuid` as `SECURITY DEFINER`, mirroring `sign_proposal`:
    1. Verify caller is a company member of the lead's `company_id`.
    2. Find-or-create `clients` row (match on normalized name + company_id).
    3. `UPDATE leads SET client_id = ..., stage = 'converted', updated_at = now() WHERE id = _lead_id`.
    4. `INSERT INTO proposals (..., lead_id, client_id, company_id, created_by) RETURNING id`.
    5. Return new `proposal_id`. All in one transaction — any failure rolls back.
  - `GRANT EXECUTE` to `authenticated`.
- **Types regenerate** automatically after migration approval — no `as any` casts.
- **New hook** `useConvertLeadToProposal` calls the RPC, surfaces errors via `toast.error` with the Postgres message.
- **Legacy** `useConvertLeadToClient` becomes a thin deprecated re-export pointing at the new hook (removed in Batch B).

### Step 2 — Funnel back-links (`LineageBreadcrumb`)
- New `src/components/shared/LineageBreadcrumb.tsx` — small chip row, accepts `{ lead, proposal, client, project }` (any subset) and renders linked badges.
- Wire into:
  - `ProjectDetail.tsx` header: "From lead {name} · proposal {number}".
  - `ClientDetailSheet`: "Originated from lead {name}" → `/bd/leads/:id`.
  - `BdLeadDetail.tsx`: shows linked client + proposal + converted project chips.
- Pure read; uses existing FKs (`projects.proposal_id`, new `proposals.lead_id`, `leads.client_id`).

### Step 3 — Leads tab becomes redirect
- In `src/pages/Proposals.tsx`: keep `<TabsTrigger value="leads">` visible; its panel renders a centered button + `useEffect` `navigate('/bd/leads', { replace: true })` when active.
- **Delete** `src/components/proposals/LeadsTable.tsx` and `src/components/proposals/LeadCaptureDialog.tsx` (verified dead).
- Remove their imports + any unused props from `Proposals.tsx`.

### Step 4 — Changelog
- Insert one `changelog_entries` row: "Lead→Proposal conversion is now atomic; project, client, and lead pages show the full funnel lineage."

### Technical notes
- **Files touched:** `supabase/migrations/<new>.sql`, `mem://index.md`, `mem://doctrine/ordino-master-prompt`, `src/hooks/useConvertLeadToProposal.ts` (new), `src/hooks/useLeadConversion.ts` (deprecate), `src/components/shared/LineageBreadcrumb.tsx` (new), `src/pages/ProjectDetail.tsx`, `src/components/clients/ClientDetailSheet.tsx`, `src/pages/BdLeadDetail.tsx`, `src/pages/Proposals.tsx`.
- **Deleted:** `src/components/proposals/LeadsTable.tsx` (~446 LOC), `src/components/proposals/LeadCaptureDialog.tsx` (~80 LOC).
- **Net LOC:** +~180 / −~580 ≈ **−400**.
- **Out of scope:** Batches B (cmd+k RPC, dashboard deep-links) and C (funnel notifications, BD/RFP/referral reports). No changes to today's billed-services tab, job-costing, calendar, email threading, or ZIP-export roadmap.
- **Order of execution after approval:** doctrine memory → migration (waits for user approval) → hook → call-site rewires → LineageBreadcrumb + wiring → Proposals tab redirect + deletions → changelog insert.
