

# Fix Proposal Email Sending

## Problem
The proposal "Send via Email" button appears to succeed but never actually delivers the email. Two issues:

1. **Silent failure handling** — The catch block in `SendProposalDialog.tsx` (lines 214-217) swallows all errors and still shows "Proposal sent successfully!" even when sending fails.
2. **Gmail connection dependency** — `sendBillingEmail` calls the `gmail-send` edge function, which requires the user to have an active Gmail OAuth connection. If no connection exists, the function returns an error that gets silently caught.

## Plan

### 1. Fix error handling in SendProposalDialog.tsx
- Show a toast error when `sendBillingEmail` throws instead of silently marking as sent
- Remove `onConfirmSend(proposal.id)` and `setSent(true)` from the catch block
- Add a user-visible error message so you know when sending actually fails

### 2. Verify Gmail connection status
- Before attempting to send, check if a Gmail connection exists for the current user
- If not connected, show a clear message: "Gmail must be connected to send emails. Go to Emails to connect your account."

## Technical Details

### File: `src/components/proposals/SendProposalDialog.tsx`

**Current (broken) catch block:**
```typescript
} catch (error: any) {
  console.error("Failed to send proposal email:", error);
  onConfirmSend(proposal.id);  // marks as "sent" even on failure!
  setSent(true);               // shows success even on failure!
}
```

**Fixed catch block:**
```typescript
} catch (error: any) {
  console.error("Failed to send proposal email:", error);
  toast({
    title: "Failed to send email",
    description: error.message || "Please check your Gmail connection.",
    variant: "destructive",
  });
}
```

- Add `useToast` import and hook
- The `onConfirmSend` call (which updates the proposal status to "sent") will only happen on actual success

### File: No other changes needed
The `sendBillingEmail` and `gmail-send` edge function are already wired correctly -- the only issue is the client-side error handling hiding failures.

