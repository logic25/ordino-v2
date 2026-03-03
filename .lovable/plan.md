

# Fix Plan: Chris's Outstanding Issues

## Issue 1: Task completion should require time logging (#11)
**Problem**: When marking a task done, the dialog only asks for an optional note. Chris wants a mandatory time log prompt.

**Fix in** `src/components/projects/CompleteActionItemDialog.tsx`:
- Add time entry fields: hours (required), description, and billable toggle
- Make the hours field mandatory -- can't click "Mark Done" without entering time
- On submit, insert a row into `time_entries` table (project_id, hours, description, date) alongside the existing completion logic
- Import and use `useAuth` to get profile info for the time entry

**Fix in** `src/hooks/useActionItems.ts`:
- Update `useCompleteActionItem` mutation to accept optional `time_entry` data (hours, description, billable)
- After updating the action item status, insert into `time_entries` if time data is provided

---

## Issue 2: Proposal email fails on first send (#9)
**Problem**: First send silently fails; resend works but arrives twice.

**Fix in** `supabase/functions/gmail-send/index.ts`:
- Investigate and add retry/error handling
- Add idempotency check (e.g., store a message hash to prevent duplicate sends)

**Fix in** `src/hooks/useProposals.ts` (`useSendProposal`):
- Add a guard: check `sent_at` before sending to prevent double-sends
- Add proper error surfacing with toast notifications if the edge function returns an error

**Fix in** `src/components/proposals/SendProposalDialog.tsx`:
- Disable the send button immediately on click to prevent double-clicks
- Surface errors from the Gmail send function clearly

---

## Issue 3: PIS applicant picker broken after clearing data (#13, #14)
**Problem**: After deleting existing applicant info in a PIS, the contact picker dropdown doesn't work.

**Fix in** `src/components/projects/EditPISDialog.tsx`:
- Debug the `SectionAutoFill` component -- the picker search input likely loses focus or the `open` state resets when values are cleared
- Ensure clearing a field properly re-enables the search picker
- Also ensure proposal contacts are included in search results (not just CRM clients/contacts)

**Fix in** `src/hooks/usePISAutoFill.ts`:
- Add proposal contacts as a data source -- query `proposal_contacts` for the project's linked proposal
- Accept a `proposalId` parameter to scope the contact search

---

## Issue 4: Service billing dates not showing in project services (#16)
**Problem**: Chris wants to see when each service was billed (sent date) and paid (paid date) in the project's services table.

**Fix in** `src/hooks/useProjectDetail.ts` (`useProjectServices`):
- Already fetching `billing_requests` -- extend to also join/fetch related `invoices` to get `sent_date` and `paid_date`
- Map these dates into the `MockService` type

**Fix in** `src/components/projects/projectMockData.ts`:
- Add `sentDate` and `paidDate` fields to the `MockService` interface

**Fix in** `src/components/projects/ProjectExpandedTabs.tsx` (or wherever the services table is rendered):
- Add "Sent" and "Paid" date columns to the services table

---

## Issue 5: Billing request not appearing in Billing section (#17)
**Problem**: Services sent to billing from a project don't show up on the main Billing page.

**Investigation needed**: Check the `useBillingRequests` hook and the Billing page query to ensure it includes billing requests created from project detail. The query may have a filter that excludes them (e.g., missing status or company_id).

**Fix in** `src/hooks/useBillingRequests.ts`:
- Verify the query fetches all billing requests regardless of how they were created
- Check if auto-created invoices are being linked properly

---

## Issue 6: Proposal shows as project before client signs (#17 - new issue)
**Problem**: Proposal 030226-1 appears as a project even though the client hasn't signed.

**Root cause**: The `useSignProposalInternal` function (line 668-702 of `useProposals.ts`) creates the project at internal sign time, not after the client counter-signs. This is by design for the current workflow (internal sign -> send -> client signs), but it means the project exists before client approval.

**Fix options**:
- **Option A**: Don't create the project until client signs. Move project creation logic into the client signing flow in `ClientProposal.tsx`.
- **Option B**: Keep the current flow but add a project status like "pending_client_signature" that hides it from the main projects list until the client signs. Show a visual indicator.
- **Option C**: Add a filter to the projects list to exclude projects whose linked proposal hasn't been client-signed yet.

**Recommendation**: Option C is simplest -- filter the projects query in `useProjects` to exclude projects where the linked proposal exists but `client_signed_at` is null and status is not "executed". This keeps the project record ready but hidden from Chris until the client actually signs.

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/components/projects/CompleteActionItemDialog.tsx` | Add mandatory time entry fields |
| `src/hooks/useActionItems.ts` | Accept time entry data on completion |
| `supabase/functions/gmail-send/index.ts` | Add error handling, idempotency |
| `src/hooks/useProposals.ts` | Add send guard, fix project visibility |
| `src/components/proposals/SendProposalDialog.tsx` | Prevent double-send |
| `src/components/projects/EditPISDialog.tsx` | Fix picker after clearing fields |
| `src/hooks/usePISAutoFill.ts` | Include proposal contacts in search |
| `src/hooks/useProjectDetail.ts` | Add sent/paid dates to services |
| `src/components/projects/ProjectExpandedTabs.tsx` | Add date columns to services table |
| `src/hooks/useBillingRequests.ts` | Verify billing request visibility |
| `src/hooks/useProjects.ts` | Filter out unsigned proposal projects |

