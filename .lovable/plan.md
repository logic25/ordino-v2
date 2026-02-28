

## Plan: Fix Chris's Follow-Up Issues (Round 2)

### Issues to Address

**1. Sent emails appearing in Inbox after Gmail sync**
The Gmail sync edge function syncs ALL emails (inbox + sent). The inbox filter in `EmailFilterTabs.tsx` does NOT exclude sent-only emails -- it only excludes archived and snoozed. Emails with the "SENT" label but no "INBOX" label still show up in the inbox tab.

**2. Company email doesn't autopopulate when selecting a company in proposal contacts**
In `ProposalContactsSection.tsx` line 335-343, `handleSelectCompany` resets `name`, `email`, and `phone` to empty when a company is selected. It does not fetch the company's own email from the `clients` table -- it only fills the company name. The client's email should be set on the contact row.

**3. Can't add more work types in Settings**
The work type list (`WORK_TYPE_DISCIPLINES` in `useCompanySettings.ts`) is hardcoded to 12 disciplines. There is no UI to add custom work types. Need to allow companies to define additional disciplines in Settings.

**4. Services step still doesn't scroll**
The outer body container at line 918-919 wraps ALL steps with `overflow-y-auto`, but the services step (step 2) at line 1088-1119 uses its own `flex-1 min-h-0 overflow-y-auto` layout. The problem is the parent `overflow-y-auto` at line 919 fights with the child's flex layout. When step === 2, the outer wrapper should NOT scroll -- the inner services container should handle it.

**5. "Save & Preview" button not working / no validation feedback**
The `doSave` function calls `form.handleSubmit(handleSubmit)()` which runs Zod validation. If validation fails, `handleSubmit` is never called and the user sees nothing -- no toast, no error highlight. The `validateStep` function only runs on "Next" clicks (step 0), not on save. Need to add an `onError` handler to `form.handleSubmit` that shows which fields are invalid.

**6. Add "Analyze work type per plans" to product roadmap**
Already acknowledged as a roadmap item. Will add it to `docs/spec.md` or the roadmap table.

---

### Technical Changes

**A. Fix sent emails in inbox** (`src/components/emails/EmailFilterTabs.tsx`)
- Update the `inbox` case in `getFilteredEmails` to exclude emails that have "SENT" label but do NOT have "INBOX" label
- Change filter: `if (isSentEmail(e) && !labels.includes("INBOX")) return false`

**B. Autopopulate company email on contact selection** (`src/components/proposals/ProposalContactsSection.tsx`)
- In `handleSelectCompany`, after setting `company_name`, set `email` to `client.email` if available (the `Client` type includes `email`)
- This gives the contact row the company's email as a starting point

**C. Allow adding custom work types** (`src/components/settings/ServiceCatalogSettings.tsx` + `src/hooks/useCompanySettings.ts`)
- Add `custom_work_types?: string[]` to `CompanySettings` interface
- In the Service Catalog settings, add a small "Manage Work Types" section or inline "Add Work Type" button
- Merge `WORK_TYPE_DISCIPLINES` with `companyData.settings.custom_work_types` wherever disciplines are displayed (ProposalDialog, ServiceCatalogSettings)

**D. Fix services step scrolling** (`src/components/proposals/ProposalDialog.tsx`)
- Change the outer scrollable body wrapper (line 919) to conditionally NOT apply `overflow-y-auto` when on the services step (step === 2)
- The services step's own inner container already has the correct flex/scroll setup
- Something like: `className={cn("flex-1", step === 2 ? "min-h-0 flex flex-col" : "overflow-y-auto")}`

**E. Show validation errors on Save/Preview** (`src/components/proposals/ProposalDialog.tsx`)
- Add an `onError` callback to `form.handleSubmit` in the `doSave` function
- In `onError`, inspect the errors object and show a toast listing the missing required fields (e.g., "Property is required", "Title is required")
- This ensures users know exactly what's blocking the save

**F. Update "Add Service" button label when editing** (`src/components/settings/ServiceCatalogSettings.tsx`)
- Line 759: The dialog footer button still says "Add Service" even when editing -- change to "Save Changes" when `editingServiceId` is set

