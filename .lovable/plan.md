

## Bug Analysis

### 1. Saved Signature Not Loading (Recurring)

**Root cause**: When the dialog opens a second time, `savedSignatureData` is already set from the previous open. The profile effect (line 107) sets it to the same value, which does NOT trigger a React re-render. Since the canvas drawing effect (line 125) depends on `[open, savedSignatureData]`, it doesn't re-fire — the signature never gets drawn.

**Fix**: In the reset effect (line 114), also reset `savedSignatureData` to `null`. This forces the profile effect to set it again (as a state change from `null` → data), which re-triggers the canvas drawing effect.

### 2. CC Option Not Available

**Root cause**: The CC section (line 307) only renders when there are other contacts besides the selected recipient. This proposal has only one contact (the Applicant), so the CC section is hidden entirely.

**Fix**: Always show the CC section, but when there are no additional contacts to select from, show a free-text email input so the user can type any email address to CC. This also adds value when contacts exist — a free-text field alongside the checkbox list.

### Changes

**File: `src/components/proposals/SignatureDialog.tsx`**

1. Add `setSavedSignatureData(null)` inside the reset effect (line 116) so the signature data is freshly loaded each time the dialog opens
2. Add a free-text CC email input (comma-separated) that always appears, in addition to the existing contact checkboxes when available
3. Merge free-text CC emails with checkbox-selected CC emails when signing

