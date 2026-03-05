

## Fix: PIS Contact Selection — Company → Contact Drill-Down + Unsaved Changes Indicator

### Problem
When searching for a company in the PIS auto-fill, selecting a client (company) only fills the business name. The user expects to **first find a company, then pick a specific contact person at that company** to populate all fields (name, email, phone, address, license info).

### Solution

**1. Two-step contact picker in `usePISAutoFill.ts`**

Change `getOptionsForSection` behavior:
- When user types a search query, show **both** companies (Building2 icon) and individual contacts as today
- When user **selects a company**, instead of immediately applying fields, filter the contact list to show only contacts at that company (`client_contacts.client_id = selected_client.id` OR `client_contacts.company_name` matches). The company itself also remains an option ("Use company info only")
- When user selects a **contact** (either directly or after drilling into a company), apply all fields (name, company, email, phone, address, license)

**Implementation:**
- Add a `selectedClientId` state to `SectionAutoFill` component in `EditPISDialog.tsx`
- When a client-type result is clicked, set `selectedClientId` and re-query contacts filtered by `client_id`
- Show a "← Back to search" link and the filtered contacts list
- Add the company itself as an "Apply company info" option at the top

**2. Fix client field mapping in `usePISAutoFill.ts`**

Even for the "apply company only" case, include `nameField` so the name field isn't left blank:
```typescript
fields: {
  [mapping.nameField]: c.name,  // ADD THIS
  ...(mapping.companyField ? { [mapping.companyField]: c.name } : {}),
  // ... rest unchanged
}
```

**3. Add contacts-by-client query to `usePISAutoFill.ts`**

Add a new query function or expand the existing hook to support filtering contacts by `client_id`:
```typescript
const getContactsForClient = (clientId: string) => {
  return contacts.filter(c => c.client_id === clientId);
};
```

This requires adding `client_id` to the contacts query select list.

**4. Unsaved changes indicator in `EditPISDialog.tsx`**

- Add `isDirty` state, set to `true` when `setValues` is called after initial load
- Show a sticky amber banner at the top: "You have unsaved changes — scroll down and click Save PIS"
- Pulse/highlight the Save button when dirty

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/usePISAutoFill.ts` | Add `client_id` to contacts query; add `nameField` to client mapping; export `getContactsForClient` helper |
| `src/components/projects/EditPISDialog.tsx` | Add two-step drill-down UI to `SectionAutoFill`; add `isDirty` state + banner + highlighted Save button |

