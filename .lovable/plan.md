## Problem

In the RFP Builder ("Build RFP Response" wizard), the logo and uploaded attachments (e.g. "Attachment 6") appear in the response but Chris cannot uncheck them — every response is forced to include them.

## Root causes (from code review of `src/components/rfps/RfpBuilderDialog.tsx`)

1. **Race condition zeroing the toggle state.** `selectedAttachmentIds` starts as `null` (meaning "all selected"). Two effects try to populate it:
   - The "default to all" effect (line 134) only runs while `!draftLoaded`.
   - The draft-load effect (line 142) sets `draftLoaded = true` immediately, but if `rfpAttachments` hasn't loaded yet at that moment it skips the fallback that copies all attachment IDs.
   - Net effect: `selectedAttachmentIds` can stay `null` forever. The UI then renders `selectedAttachmentIds || rfpAttachments.map(...)` on every render, so the checkbox always *looks* checked again after toggling because the parent prop snaps back to "all".
2. **Logo can never be excluded.** `assembledContent.logoUrl` falls back to `companyData.settings.company_logo_url || companyData.logo_url` (line 445). Even when the user unchecks the logo attachment (or the entire Attachments section), the company logo is re-injected into the PDF and the email header. There is no per-response "no logo" switch.
3. **Attachments are opt-out, not opt-in.** Defaulting every attachment in the library to "included" on every new RFP is the source of the "mandatory" feeling — Chris has many files in the library and doesn't want all of them attached to every submission by default.

## Fix

### A. Make selection state authoritative
- Stop using `null` as a sentinel for `selectedAttachmentIds` / `selectedProjectIds`. Initialize as `[]` and persist explicitly.
- Remove the `prev || rfpAttachments.map(...)` fallbacks inside `toggleAttachmentSelection`, `selectAllAttachments`, `clearAttachmentSelection`, and inside the `StepEditContent` props — pass the real array.
- Replace the two competing init effects with a single effect that runs once when both the draft query and `rfpAttachments` query have settled:
  - If draft has `selected_attachment_ids`, use it (intersected with current library so stale IDs drop out).
  - Else: default to **empty** (opt-in). Same change for `selected_project_ids` is out of scope — projects keep the current "all by default" behavior since that matches existing UX expectations.

### B. Per-response logo control
- Add a `include_logo` boolean to the wizard state (default `true`), persisted on the draft alongside `selected_attachment_ids`.
- In Step 1 ("Edit"), inside the Attachments collapsible, add a top row: a single checkbox **"Include company logo in header"** (separate from library attachments, since the logo is rendered as PDF/email header art, not as a file attachment).
- When `include_logo === false`, force `assembledContent.logoUrl = undefined` regardless of `rfpLogoUrl` or `companyData` fallback. The email/PDF header already renders the company name when no logo is present.

### C. Persist new fields
- Extend `useUpsertRfpDraft` payload typing (`src/hooks/useRfpDraft.ts`) to include `selected_attachment_ids: string[]` and `include_logo: boolean`. The underlying column already accepts arbitrary JSON metadata via the `as any` cast, so no migration is required — verify by reading one row after save.

### D. UX clarity in Step 0 ("Select")
- Update the Attachments section card subtitle to read "`X of Y selected`" using `selectedAttachmentIds.length` instead of the raw library count, so users see at a glance that the section is empty by default.

## Files to touch

- `src/components/rfps/RfpBuilderDialog.tsx` — state model, effects, toggle handlers, logo gating, attachments UI in Step 1.
- `src/hooks/useRfpDraft.ts` — extend `RfpDraft` interface and `useUpsertRfpDraft` payload type.
- (No DB migration; metadata persists in the existing draft row.)

## Verification in sandbox (mandatory before declaring done)

1. Open `/rfps`, pick an existing RFP with attachments in the library, click "Build Response".
2. Step 0: confirm Attachments shows `0 / N selected`.
3. Step 1: expand Attachments. Confirm:
   - Every library file starts **unchecked**.
   - Clicking a checkbox toggles it and the state sticks across re-renders.
   - "Select All" / "Clear" both work.
   - The new "Include company logo in header" checkbox toggles cleanly.
4. Click "Full Preview". Confirm:
   - With logo unchecked → preview shows company name, no logo image.
   - With one attachment checked → only that file is listed (and only that file is attached when sending — verify by inspecting `attachments` in the submit payload via console).
5. Close and reopen the dialog → selections persist (draft was saved).
6. `bunx tsc --noEmit` passes.

Only after all six checks pass do we report the fix as complete.
