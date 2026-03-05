

## Plan: Backfill Existing Properties & Auto-Lookup for New Ones

### Current State
There are **11 properties** in the database missing Borough/Block/Lot data. The Property Dialog already has a manual "Lookup" button, but it's not triggered automatically.

### Part 1: One-Time Backfill via Edge Function

Create a new edge function `backfill-property-bbl` that:
1. Queries all properties where `borough IS NULL OR block IS NULL OR lot IS NULL`
2. For each, calls the NYC PLUTO Open Data API (same logic as `useNYCPropertyLookup`)
3. Updates the property record with found BBL/BIN/zip/owner data
4. Returns a summary of what was filled vs. not found

Then add a "Backfill Missing Data" button on the Properties page (admin-only) to trigger it.

**File:** `supabase/functions/backfill-property-bbl/index.ts`

### Part 2: Auto-Lookup on New Property Creation

Modify `PropertyDialog.tsx` so that when a user types/pastes an address and tabs out (blur event), the NYC lookup fires automatically — no need to click the Lookup button manually. The button remains as a fallback.

**File:** `src/components/properties/PropertyDialog.tsx` — add `onBlur` handler on the address input that triggers `handleAddressLookup` if BBL fields are still empty.

### Part 3: Auto-Lookup on Property Save (safety net)

In `useCreateProperty` hook, after creating the property, if BBL is missing, trigger a client-side lookup and update. This ensures even if the user skips the dialog lookup, the data gets filled on save.

**File:** `src/hooks/useProperties.ts` — in `useCreateProperty.mutationFn`, after insert, if `borough/block/lot` are null, call NYC API and update the record.

### Summary of Changes
| File | Change |
|------|--------|
| `supabase/functions/backfill-property-bbl/index.ts` | New edge function to backfill all existing properties |
| `src/pages/Properties.tsx` | Add "Backfill BBL Data" button for admin |
| `src/components/properties/PropertyDialog.tsx` | Auto-trigger lookup on address blur |
| `src/hooks/useProperties.ts` | Post-save auto-lookup safety net |

