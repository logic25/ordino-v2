## Bug

When a user opens **Send to Billing** from a project's Services tab and submits a billing request, the **Project** field at the top of the dialog appears blank — even though the underlying value is set correctly and billing still works.

## Root cause

The dropdown trigger only displays a project's name if a matching `<SelectItem>` is rendered for that project ID. Two filters can hide the preselected project from the list:

1. `src/components/invoices/SendToBillingDialog.tsx` line 41 filters the option list down to projects with `status === "open"`. Projects with any other status (`closed`, `on_hold`, etc.) won't render an option, so the trigger falls back to the placeholder text.
2. `useProjects()` in `src/hooks/useProjects.ts` (lines 96–103) hides projects whose linked proposal hasn't been client-signed and isn't `executed`. A project that's billable through other means (manual services, change orders, etc.) can therefore be missing from the list entirely.

Because the dialog is opened with `preselectedProjectId={project.id}` from `ServicesFull.tsx`, the value is set internally, but the visible label is empty whenever the project is filtered out for either of the two reasons above.

## Fix

Keep the change in the presentation layer of the dialog only — do not modify `useProjects()` or the underlying billing logic.

In `src/components/invoices/SendToBillingDialog.tsx`:

1. Build the project options list by starting from `billing.projects`, then **always include the currently selected project** (`billing.selectedProject`) if it isn't already in the filtered list. This handles both the status filter and the proposal-not-signed filter.
2. Apply the existing `status === "open"` filter only to the *other* projects (so the dropdown still hides irrelevant projects when the user is choosing manually), but never to the preselected/current one.
3. As a defensive fallback, if `billing.selectedProject` is undefined but `billing.projectId` is set (project not yet loaded or fully filtered out), render a disabled `SelectItem` for that ID using the project number/name from a lightweight lookup (or a simple "Selected project" label) so the trigger always shows something.

Pseudocode for the dropdown content:

```text
options = projects.filter(status === "open")
if selectedProject and not in options: options.unshift(selectedProject)
render options
```

## Verification

- Open a project whose status is `open` and one whose status is `on_hold` (or that has an unsigned linked proposal). In both cases, click **Send to Billing** from the Services tab and confirm the Project field shows the correct project number and name.
- Submit a billing request and confirm the request is still created against the correct project.
- Open the dialog from any other entry point (no preselection) and confirm the dropdown still lists only `open` projects for manual selection.

## Out of scope

- No changes to `useProjects()`, billing submission logic, or invoice creation.
- The unused `<SendToBillingDialog>` instance in `src/pages/Invoices.tsx` is left as-is.
