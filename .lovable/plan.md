

## Problem & Solution Summary

### Problem: Plan filenames not showing on the public PIS form

When a proposal is created and plans are uploaded, then the PIS is sent to the client for signature, the client-facing PIS form should display the names of the plan files already on file (e.g., "Plans: 2026.02.13___200RiverBlvd46C.pdf"). Currently it shows nothing.

**Root cause**: The `useRfiByToken` hook (lines 352-371 of `src/hooks/useRfi.ts`) queries the `universal_documents` table directly to fetch plan filenames. However, the public PIS form is accessed by **unauthenticated users**, and the RLS policy on `universal_documents` requires `is_company_member(company_id)` — which fails silently, returning an empty array.

### Solution: Security Definer function + RPC call

Instead of loosening RLS on `universal_documents` (which would expose storage paths, internal IDs, and metadata), we create a **SECURITY DEFINER function** that:

- Accepts the RFI `access_token` (already present in the URL the client clicks — `/rfi?token=abc123`)
- Validates the token against `rfi_requests`
- Returns **only filenames** (no IDs, no storage paths)
- Runs with elevated privileges internally, so no RLS changes needed

The client experiences zero friction — the token is already in their URL and is used automatically behind the scenes.

### Changes

**1. Database migration — new function**

```sql
CREATE OR REPLACE FUNCTION public.get_rfi_plan_filenames(_access_token text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT d.filename), '{}')
  FROM rfi_requests r
  JOIN universal_documents d
    ON d.category = 'Plans'
    AND (
      (r.proposal_id IS NOT NULL AND d.proposal_id = r.proposal_id)
      OR (r.project_id IS NOT NULL AND d.project_id = r.project_id)
      OR (r.property_id IS NOT NULL AND d.property_id = r.property_id)
    )
  WHERE r.access_token = _access_token
$$;
```

**2. Frontend — `src/hooks/useRfi.ts`**

Replace lines 352-371 (the `universal_documents` query loop) with a single RPC call:

```ts
// Fetch existing plan filenames via secure RPC (bypasses RLS for unauthenticated users)
const { data: planNames } = await supabase.rpc('get_rfi_plan_filenames', {
  _access_token: token,
});
let existingPlanNames: string[] = (planNames as string[]) || [];
```

This removes ~20 lines of query logic and replaces it with one secure call. No RLS changes. No new client-facing steps. The existing UI code that renders `existingPlanNames` will start working immediately.

