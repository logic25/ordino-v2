

# RFP Response Email Redesign: Add Logo + Brand-Aligned Design

## Problem
1. The RFP response email has no company logo — there's no way to include it
2. The email design (green header bar, plain layout) doesn't match the Greenlight Expediting brand from the refresh site (black/charcoal with chartreuse/yellow-green accents, clean Apple-esque typography)

## What the Greenlight Refresh brand looks like
- **Colors**: Black/charcoal primary, chartreuse-green accent (`hsl(65, 85%, 42%)` ≈ `#b5cc18`), white backgrounds
- **Typography**: Inter font, tight tracking, clean and modern
- **Style**: Minimal, professional, no heavy borders — subtle separators, lots of whitespace

## Changes

### 1. Pass company logo into RFP email builder
**File: `src/components/rfps/RfpBuilderDialog.tsx`**
- Already fetches company data — extract `logo_url` from company settings (same pattern as proposals/invoices)
- Pass `logoUrl` into `buildRfpEmailHtml()`

### 2. Redesign `buildRfpEmailBody.ts` to match brand
**File: `src/components/rfps/buildRfpEmailBody.ts`**
- Add `logoUrl` to `AssembledContent` interface
- Replace the green header with a clean white header containing the company logo + a thin chartreuse accent line (matching the branded email shell pattern)
- Update color palette:
  - Header: white background with logo, thin `#b5cc18` accent border
  - Section headings: charcoal text, subtle bottom border (not uppercase blocky)
  - Cards/tables: lighter borders, more whitespace
  - Remove the heavy colored left-borders on sections
  - Use Inter font stack
- Keep all existing section renderers but restyle them for the cleaner aesthetic
- Footer with company name/address/phone in muted text

### 3. Add "Company Logo" upload to Content Library (optional but recommended)
**File: `src/components/rfps/ContentLibraryTabs.tsx`** (or Company Info tab)
- The company logo is already uploadable in Settings → Company. No new upload needed — just pull from `companies.logo_url`
- Add a note in the Company Info tab showing which logo will be used, with a link to Settings if they want to change it

## Files Changed

| File | Change |
|------|--------|
| `src/components/rfps/buildRfpEmailBody.ts` | Add `logoUrl` to interface, redesign all HTML to match Greenlight brand |
| `src/components/rfps/RfpBuilderDialog.tsx` | Pass `logoUrl` from company data into email builder |
| `src/components/rfps/RfpPreviewModal.tsx` | Pass `logoUrl` for preview parity |

