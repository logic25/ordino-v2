

# Assessment of Claude's Plan — Mostly Correct, With Adjustments

Claude's diagnosis is solid across all 6 bugs. Here's where I agree and where I'd adjust:

## Bug 1: "Unassigned" in Billing — Agree with diagnosis, adjust fix location

Claude correctly identifies the issue. The `WeeklyTimesheet.tsx` (line 26-28) falls back to "Unassigned" when `entry.dob_applications` is null. This happens when time is logged with a `service_id` or `project_id` but no `application_id`.

**My fix:** In `WeeklyTimesheet.tsx`, add fallback resolution using the `services` join that's already in the `useTimeEntries` query. The label resolution should be:
```
entry.dob_applications?.properties?.address
?? entry.services?.dob_applications?.properties?.address  // ← NEW fallback
?? entry.dob_applications?.job_number
?? entry.description
?? "Unassigned"
```
The `useTimeEntries` query already joins `services(id, name)` but needs to expand to include `services(id, name, dob_applications(id, properties(address)))`.

## Bug 2: PIS work-types not auto-filled — Agree, minor adjustment

Claude is correct that `proposal_items` isn't in the query. However, looking at line 290, `proposal_contacts` IS already included in the proposals select. We just need to add `items:proposal_items(name, is_optional)` to the same select.

Then in `RfiForm.tsx` auto-fill effect (line 256-338), add work-type auto-fill using `building_and_scope_work_types_selected` — the key is already confirmed at line 220.

**But:** The `useRfiByToken` hook doesn't currently return `proposalItems`. We need to pass them through the return object, then map item names to work type options in the form.

## Bug 3: Applicant name not auto-filled — Already works, but indirectly

Looking at lines 284-294 of `RfiForm.tsx`, applicant fields ARE being auto-filled from `projectData.architect_contact_name`. The chain is: `useRfiByToken` → line 357 resolves `architect_contact_name` from CRM > project > applicantContact > proposal fields. So "Marrina" should already appear IF:
- She was saved as a proposal contact with role "applicant"
- OR her name is on the project's `architect_contact_name`

If this isn't working, the issue may be that the proposal contact wasn't saved correctly, or the priority chain at line 357 isn't picking it up. I'll add explicit applicant auto-fill as a safety net, as Claude suggests.

## Bug 4: GC/TPP/SIA only shows "Yes" — Agree with diagnosis

The defaults at line 119 DO include `["Yes", "No"]`. The issue is likely a saved template overriding defaults. Claude's suggestion to sanitize in `useMemo` (line 247-250) is correct — merge saved sections with default option arrays for these specific fields.

## Bug 5: Optional services created — Agree completely

Line 162 — one-line fix: add `.filter((item: any) => !item.is_optional)`. Claude is exactly right.

## Bug 6: Blank screen after CO creation — Agree completely

Lines 548-552 — the sheet opens before query refetches. Fix: await `queryClient.invalidateQueries` before `setCoSheetOpen(true)`. Claude's primary fix is correct and simpler than the alternative.

---

## Summary — 6 file changes

| Bug | File(s) | Change |
|-----|---------|--------|
| 1 | `useTimeEntries.ts`, `WeeklyTimesheet.tsx` | Expand services join, add fallback label resolution |
| 2 | `useRfi.ts`, `RfiForm.tsx` | Add `proposal_items` to query, auto-fill work types |
| 3 | `RfiForm.tsx` | Add explicit applicant auto-fill (safety net) |
| 4 | `RfiForm.tsx` | Sanitize saved template options for gc/sia/tpp_known |
| 5 | `useProposalFollowUps.ts` | Filter `!item.is_optional` (1 line) |
| 6 | `ProjectDetail.tsx` | Await query invalidation before opening CO sheet |

