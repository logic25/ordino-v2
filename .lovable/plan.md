

# Enhance Triage with Architectural Context + Fix 5 Times Square Bug

## What was done

**Bug patterns seeded** — 7 known patterns are now in the `bug_patterns` table. The triage function already queries and matches these against new bugs automatically.

## What still needs to happen

### 1. Add PAGE_CONTEXT to triage prompt

In `supabase/functions/triage-bug-report/index.ts`, add a `PAGE_CONTEXT` map with architectural notes per page. When triage runs, inject the matching context into the AI prompt so it understands *how* each page works internally.

Example for Properties:
> "Uses NYC GeoSearch API → PLUTO cross-verification in useNYCPropertyLookup.ts. Common failure: strict street name validation rejects named buildings (e.g. '5 Times Square' maps to '592 7 Avenue' in PLUTO). The verifyBBLWithPLUTO function confirms BBL but streetNamesMatch can reject valid results."

Similar notes for Proposals (signature canvas timing, email HTML vs preview), Email (Gmail OAuth, thread sync), RFPs (partner response flow, M/WBE attachments), Projects (PIS sync, phase auto-advance), etc.

### 2. Fix the 5 Times Square property lookup

In `src/hooks/useNYCPropertyLookup.ts`, the GeoSearch strategy currently does:
1. GeoSearch returns a BBL + address label
2. Checks house number match
3. Checks street name match via `streetNamesMatch()`
4. Cross-verifies BBL with PLUTO

The fix: **move the `streetNamesMatch` check after PLUTO verification, and skip it if PLUTO confirms the BBL.** When PLUTO says "yes, this BBL exists and here's the owner," the lookup is authoritative regardless of whether the display name matches the tax-lot street address.

Specifically in lines ~186-210: restructure to call `verifyBBLWithPLUTO` first, then only run `streetNamesMatch` as a fallback filter when PLUTO verification fails.

### 3. Auto-learn on bug resolution

In `src/components/helpdesk/BugReports.tsx`, when status changes to "resolved," automatically invoke the triage function with `action: "learn_pattern"` to populate patterns from every fix. This makes the system smarter over time without manual intervention.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/triage-bug-report/index.ts` | Add `PAGE_CONTEXT` map, inject into prompt |
| `src/hooks/useNYCPropertyLookup.ts` | Skip `streetNamesMatch` when PLUTO BBL is verified |
| `src/components/helpdesk/BugReports.tsx` | Call `learn_pattern` on status → "resolved" |

