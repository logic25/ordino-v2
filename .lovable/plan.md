# Permit Playbooks — Implementation

Database, RLS, storage bucket, and Bronxville seed are already live. This plan covers the remaining code so the feature is usable end to end.

## Files to create

**Backend / shared**
- `supabase/functions/research-playbook/index.ts` — Lovable AI Gateway call (`google/gemini-2.5-flash`). Input: `{ market_name, state, permit_type, questions: [{id, question, kind}], existing_qa? }`. Output per question: `{ id, answer, source, confidence: 0-1 }`. Prompt forbids fabrication; missing info returns empty answer + `confidence: 0`. CORS + JWT verified.
- `src/lib/permitPlaybookTemplate.ts` — 9 standard slots (submission method, turnaround, fees, dept contact, required forms, pre-requisites, inspections, renewal, gotchas) with `{ id, question, kind }`.

**Hooks**
- `src/hooks/usePermitPlaybooks.ts` — list by market, get by id, create (seeded with template, empty unverified), update slot, verify slot, unverify slot, delete, attachments add/remove (Storage `permit-playbooks` bucket, path `{playbook_id}/{filename}`), run AI research, accept/reject AI suggestion.
- `src/hooks/useMarketForAddress.ts` — stub returning `null` for now (project-side integration is out of scope).

**Components** (`src/components/playbooks/`)
- `PlaybookList.tsx` — cards per playbook on a market, showing "N of M verified" and last verified date.
- `AddPlaybookDialog.tsx` — pick permit type (free text + common presets), creates playbook seeded from template.
- `QARow.tsx` — one slot: question, answer (inline edit), verified badge (green w/ verifier name+date) or AI-draft badge (amber w/ confidence dot + source link). Actions: Edit, Verify, Unverify, Re-research this slot.
- `QAList.tsx` — renders rows + add custom question.
- `AttachmentsPanel.tsx` — drag-drop upload, list, download, delete.
- `EnrichDiffDialog.tsx` — shows AI suggestions side-by-side with current values. Verified slots render locked (grayed, "Protected — unverify first to overwrite"). Per-slot Accept / Reject. Accepting writes as unverified AI draft.
- `PlaybookEditor.tsx` — header with progress, summary field, QAList, AttachmentsPanel, "Research with AI" (fills only empty slots), "Re-research / enrich" (opens diff dialog).

**Routes / nav**
- `src/App.tsx` — add `/markets/:marketId/playbooks/:id` → `PlaybookEditor`.
- `src/pages/Markets.tsx` — Details panel: add "Playbooks" section using `PlaybookList` + `AddPlaybookDialog`.

## Behavior rules (safety)
- AI fills only slots where `answer` is empty OR slot is already an unverified AI draft. Never touches `verified=true`.
- Every AI write sets `ai_generated: true, verified: false, source, confidence, last_ai_research_at`.
- "Verify" sets `verified: true, verified_by: current user profile id, verified_at: now()`, clears `ai_generated`. Updates `last_verified_at` on the playbook if all slots verified.
- "Unverify" clears verification fields (required before AI can overwrite).
- Beacon `lookup_permit_playbook` already returns only the qa jsonb — Beacon callers should check `verified` per slot when citing.

## Changelog
Single `changelog_entries` row: `tag='feature'`, title "Permit Playbooks", description per spec.

## Verification
1. `select permit_type, jsonb_array_length(qa) from permit_playbooks;` → Bronxville Sign Permit row, 9 slots.
2. Open Bronxville Sign Permit → all seeded answers render with green Verified badge.
3. Add a custom empty slot → click "Research with AI" → slot fills amber with confidence dot; seeded green slots untouched.
4. Click Verify on the amber slot → flips green with current user + today's date.
5. Click "Re-research / enrich" → diff dialog shows verified slots as locked/protected, only unverified slots accept suggestions.

## Out of scope (deferred)
Project-side surfacing of relevant playbooks, cross-company library, auto-verification cron, Q&A version history.