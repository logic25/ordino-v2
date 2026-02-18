

## Fix: "Add Contact" Dialog Won't Close

### Problem

The `AddContactDialog` component (src/components/clients/AddContactDialog.tsx) has the same profiles query bug we already fixed in `useClients.ts`:

```typescript
// Line 61-64 - BROKEN
const { data: profile } = await supabase
  .from("profiles")
  .select("company_id")
  .single();  // <-- crashes with 406 if 0 or 2+ rows, no user filter
```

When "Add Contact" is clicked, the mutation fails because `.single()` throws a 406 error (no user ID filter means it could match multiple rows). Since it throws before the insert, `onSuccess` never fires, and the dialog stays open.

### Fix (1 file)

**src/components/clients/AddContactDialog.tsx (lines 61-65)**

Replace the broken query with the same fix applied elsewhere:

```typescript
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("profiles")
  .select("company_id")
  .eq("user_id", user?.id)
  .maybeSingle();
```

Also add an `onError` handler to the mutation so any future failures show a toast instead of silently failing.
