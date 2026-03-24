

## Plan: Match CO PDF Header to Proposal Header Exactly

### Problem
The CO PDF header doesn't show company details (address, phone, email, website) because it only reads from `settings.company_address` etc., which may be empty. The proposal falls back to the company table's direct columns (`company.address`, `company.phone`, etc.) — the CO doesn't.

### Fix — `src/components/projects/ChangeOrderDetailSheet.tsx`

Update the `generatePdfBlob` function to use the same fallback pattern as the proposal:

```typescript
companyAddress={settings?.company_address || companySettings?.address || ""}
companyPhone={settings?.company_phone || companySettings?.phone || ""}
companyEmail={settings?.company_email || companySettings?.email || ""}
companyWebsite={settings?.company_website || companySettings?.website || ""}
```

Currently it only passes `settings?.company_address` with no fallback — that's why the header is blank beneath the logo.

### No changes needed to `ChangeOrderPDF.tsx`
The PDF component rendering logic is already correct (logo-only when logo exists, address/phone/email/website below it). The data just isn't reaching it.

### Files
- `src/components/projects/ChangeOrderDetailSheet.tsx` — add fallbacks on 4 props

