

## Plan: Fix Sentry "Invalid time value" Errors

### Problem
`RangeError: Invalid time value` crashes on property pages when `format(new Date(dateStr))` receives malformed date strings.

### Changes

#### 1. Create shared safe date utility
**New file: `src/lib/dateUtils.ts`**
```typescript
import { format, isValid } from "date-fns";

export function safeFormatDate(
  dateStr: string | null | undefined,
  fmt: string,
  fallback = "—"
): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt) : fallback;
}
```

#### 2. Apply safe formatting to crash sites

- **`src/pages/PropertyDetail.tsx`** — line 771: replace `format(new Date(app.filed_date), ...)` with `safeFormatDate(app.filed_date, ...)`
- **`src/components/properties/SignalSection.tsx`** — line 19-25: add `isValid` guard on `parseISO(expiresAt)` before using the date
- **`src/components/properties/signal-enroll/CompSection.tsx`** — line 70: replace `format(new Date(computedExpiresAt), ...)` with `safeFormatDate`
- **`src/components/properties/SignalEnrollDialog.tsx`** — line 136: replace `format(new Date(computedExpiresAt), ...)` with `safeFormatDate`

#### 3. Consolidate COSummaryView
**`src/components/properties/co/COSummaryView.tsx`** — replace the local `safeFormat` helper (lines 24-27) with an import of the shared `safeFormatDate` utility. All existing `safeFormat` calls get renamed.

### Other Sentry errors
The `proposalDocumentHtml`, `paginated`, `ReadinessChecklist`, and `generateChecklist` reference errors are from stale cached JS bundles — no code fix needed. Resolve them manually in Sentry after this deploy.

### Files
- `src/lib/dateUtils.ts` (new)
- `src/pages/PropertyDetail.tsx`
- `src/components/properties/SignalSection.tsx`
- `src/components/properties/signal-enroll/CompSection.tsx`
- `src/components/properties/SignalEnrollDialog.tsx`
- `src/components/properties/co/COSummaryView.tsx`

