

# Live CRM Sync for PIS + Save Confirmations

## What Changes

### 1. Toast confirmations for Company and Contact dialogs
Right now, saving a company (ClientDialog) or editing a contact (EditContactDialog) gives no visible feedback. We'll add success/error toast notifications to both, matching the pattern already added for inline contact row saves.

### 2. PIS form pulls latest CRM data on load
Currently the PIS reads stale, copied fields from the project record (architect_contact_name, architect_email, etc.). If you update a contact in the CRM, the PIS doesn't reflect it. We'll fix this by having the PIS query the latest contact data directly from the CRM when it loads, using project.client_id to find the primary contact.

This means: edit a contact in the CRM, open the PIS link, and you'll see the updated info immediately -- no need to resend.

## Files to Edit

**`src/components/clients/ClientDialog.tsx`**
- Add toast notification on successful company create/update
- Add error toast on failure

**`src/components/clients/EditContactDialog.tsx`**
- Add toast notification on successful contact update
- Add error toast on failure

**`src/hooks/useRfi.ts`**
- After fetching the project, query `client_contacts` for the project's `client_id`
- Find the primary contact (is_primary = true, or first contact as fallback)
- Override stale project fields (architect_contact_name, architect_email, architect_phone) with fresh CRM data
- Fall back to existing project data if no contacts found

## How It Works

```text
User edits contact in CRM
  -> Toast confirms "Contact saved"

Client opens PIS link
  -> Form loads RFI + project (existing)
  -> Also fetches latest client_contacts for that client (new)
  -> Pre-fills applicant fields from live CRM data
  -> Falls back to project record if no match
```

No database triggers or schema changes needed -- this is purely a read-layer fix.

