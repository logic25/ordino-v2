
# Fix CO Timeline Details and Send-to-Email Tracking

## Problems
1. The CO timeline shows "Signed internally" and "Sent to client" but doesn't say **who** signed or **which email** it was sent to
2. The CO currently in the database already shows "Sent to client — awaiting" even though the client has no email (this happened before the validation fix was added)
3. The `internal_signed_by` field stores a profile ID but the UI never resolves it to a name

## Changes

### 1. Database Migration -- Add `sent_to_email` column
Add a `sent_to_email` text column to the `change_orders` table so we can record exactly which email address a CO was sent to.

```sql
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS sent_to_email text;
```

### 2. Update `handleSend` to store the recipient email
In `ChangeOrderDetailSheet.tsx`, after confirming a valid contact email exists, pass the email to the mutation so it gets saved on the CO record alongside `sent_at`.

### 3. Update `useSendCOToClient` hook to accept and store email
Modify the mutation in `useChangeOrders.ts` to accept an optional `sent_to_email` parameter and include it in the update.

### 4. Enhance Timeline with signer name and email
- Query the `profiles` table using `co.internal_signed_by` to resolve the signer's display name
- Show the signer name in the timeline: "Signed internally by **Manny Russell** on 02/26/2026"
- Show the recipient email in the timeline: "Sent to **client@email.com** on 02/26/2026"
- Also show the email in the "Client Signature" tracker card when awaiting

### 5. Show signer name in the Internal Signature tracker card
Instead of just "Signed 02/22/2026", show "Manny Russell -- 02/22/2026"

## Technical Details

**Files to modify:**
- `supabase/migrations/` -- new migration for `sent_to_email` column
- `src/hooks/useChangeOrders.ts` -- update `ChangeOrder` interface and `useSendCOToClient` mutation
- `src/components/projects/ChangeOrderDetailSheet.tsx` -- resolve signer name via useQuery, pass email to send mutation, enhance timeline entries

**Data fetch for signer name:**
Use a simple query inside the component:
```typescript
const { data: signerProfile } = useQuery({
  queryKey: ["profile", co.internal_signed_by],
  enabled: !!co.internal_signed_by,
  queryFn: async () => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, first_name, last_name")
      .eq("id", co.internal_signed_by!)
      .single();
    return data;
  },
});
```
