

# Chris's Feedback: Implementation + Status Email

## Summary

We will fix all bugs and UX issues from Chris's feedback, then compose a professional email to Chris documenting every item and its resolution. The work is broken into 3 phases.

---

## Phase 1: Bug Fixes (Critical)

### 1. Contact name not pre-populated in Add Contact dialog
- **File**: `src/components/proposals/ProposalContactsSection.tsx` -- update `ContactPicker.onAddNew` to pass the current `search` text
- **File**: `src/components/clients/AddContactDialog.tsx` -- add a `defaultName` prop that pre-fills `first_name` on open

### 2. Newly created contact doesn't appear in the Contact dropdown
- **File**: `src/components/proposals/ProposalContactsSection.tsx` -- after `onContactCreated` fires, manually append the new contact to the `ContactPicker`'s local `contacts` state (add a refresh key or callback)

### 3. Change Order creation always saves as "draft"
- **File**: `src/pages/ProjectDetail.tsx` line 485 -- change `status: asDraft ? "draft" : "draft"` to `status: asDraft ? "draft" : "pending"`

### 4. Upload button in project Docs tab is a placeholder
- **File**: `src/pages/ProjectDetail.tsx` line 1888 -- replace the toast with a hidden file input that uploads to the `universal-documents` storage bucket and inserts a row into `universal_documents`

### 5. Time logged in Time page doesn't show in project detail
- **File**: `src/pages/ProjectDetail.tsx` line 208 -- replace hardcoded `timeEntries: MockTimeEntry[] = []` with a real query to the `activities` table filtered by the project's application IDs

---

## Phase 2: UX Improvements

### 6. Service catalog Save button hard to find
- **File**: `src/components/settings/ServiceCatalogSettings.tsx` -- add a sticky footer save bar that shows when the form is dirty (services differ from saved state), with a "You have unsaved changes" indicator

### 7. Service descriptions not obvious
- Add helper text to proposal line items: "Click the row to expand and add a description/scope"
- Auto-expand the first service line item so the description field is visible

### 8. RFP Builder can't add content from library inline
- **File**: `src/components/rfps/RfpBuilderDialog.tsx` -- replace the "Edit in Content Library" external link with an inline dialog/sheet that lets users add new content entries directly within the builder

### 9. Add "Log Time" button within a project
- **File**: `src/pages/ProjectDetail.tsx` -- add a "Log Time" button in the Time Logs tab that opens `TimeEntryDialog` pre-filled with the project

### 10. Add "Add Contact" button to project Contacts tab
- **File**: `src/pages/ProjectDetail.tsx` -- add an "Add Contact" button that opens `AddContactDialog` for the project's client

---

## Phase 3: Auth Branding

### 11. Add "Powered by AI" accent to login page
- **File**: `src/pages/Auth.tsx` -- add a subtle "Powered by AI" pill/badge beneath the tagline, keeping the mobile/offline messaging

---

## Phase 4: Status Email to Chris

After all fixes are implemented and verified, compose a professional email to Chris that lists each of his 16 feedback items with:
- His original question/issue (quoted or paraphrased)
- The status: **Fixed**, **Improved**, or **By Design** with explanation
- Brief instructions on how to use the feature if it was unclear

The email will be drafted in the chat for your review before sending.

---

## Items Addressed as "By Design" (explained in email, no code change)

| Chris's Question | Response |
|---|---|
| "Are none of the services added yet?" | Services come from the catalog in Settings. Type custom names directly, or add to catalog first. |
| "Where do you enter service descriptions?" | Click the chevron on any line item to expand -- description is inside. |
| "Is Sign and Send the only way to convert?" | No -- "Mark Approved" also converts to a project for manual approvals. |
| "Is there going to be an Activities task?" | Yes -- task/activity system within services is in progress. |
| "Is Billing going to link with QB?" | QBO integration widget exists; once credentials are connected, invoices sync. Without QB, use invoice status workflow. |
| "I billed a service but don't see it in billing" | "Send to Billing" creates a billing request. Accounting converts it to an invoice, which then appears in Reports. |
| "Services in my proposal are not searchable in Settings" | By design: catalog = templates, proposal items = instances. We will add a "Save to Catalog" action in a future update. |

---

## Technical Notes

- No database migrations required -- all changes are frontend/UI
- The document upload uses the existing `universal-documents` storage bucket and `universal_documents` table
- Time entries query will use the existing `activities` table with project/application filtering
- The sticky save bar pattern follows standard React dirty-state detection (compare current services array to saved snapshot)

