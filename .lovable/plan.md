
## Fix: Blank Page When Creating New Company From Proposal Wizard

### Problem Identified

When clicking "Create Company" from the slide-out dialog in the proposal wizard, the app crashes to a blank page. Through sandbox testing, I found the root cause:

1. The `useCreateClient` hook queries the `profiles` table for `company_id` using `.single()` 
2. This query returns a **406 error** (meaning `.single()` got zero or multiple rows)
3. This throws "No company found for user" -- an **unhandled promise rejection**
4. Since there's no error boundary, React's entire tree unmounts, resulting in a blank page

### Fix Plan

**1. Fix the profiles query in `useCreateClient` (src/hooks/useClients.ts)**
- Change `.single()` to `.maybeSingle()` to avoid the 406 crash when the query returns no results
- Add the user's auth ID filter (`eq("id", user.id)`) so the query targets the correct profile row
- This is the same pattern used elsewhere in the codebase

**2. Add error handling to the `onSubmit` in ProposalContactsSection (src/components/proposals/ProposalContactsSection.tsx)**
- Wrap the `onAddClient` call in a try/catch so that if the mutation fails, it shows a toast error instead of crashing the whole page
- Same for the `onContactCreated` flow

**3. Add error handling in ProposalDialog's onAddClient callback (src/components/proposals/ProposalDialog.tsx)**
- Wrap `createClient.mutateAsync` in try/catch with a toast notification on failure

### Technical Details

**File: `src/hooks/useClients.ts` (lines 88-97)**
```typescript
// Before (broken):
const { data: profile } = await supabase
  .from("profiles")
  .select("company_id")
  .single();  // crashes with 406 if 0 or 2+ rows

// After (fixed):
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("profiles")
  .select("company_id")
  .eq("id", user?.id)
  .maybeSingle();
```

**File: `src/components/proposals/ProposalContactsSection.tsx` (renderDialogs)**
- Add try/catch around `onAddClient(data)` call with toast error fallback

**File: `src/components/proposals/ProposalDialog.tsx` (onAddClient callback)**
- Add try/catch around `createClient.mutateAsync(data)` with toast error fallback

This is a 3-file fix that addresses both the root cause (bad query) and adds safety nets (error handling) so even if future errors occur, the user sees a toast message instead of a blank page.
