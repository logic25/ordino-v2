

## Two Fixes: Smarter AI Plan Prompt + Drag-to-Reorder Service Lines

### 1. Improve the AI Plan Analysis Prompt

**Problem:** The current prompt uses an apartment renovation example and says "state the work type," which leads the AI to classify filings (ALT1, ALT2, etc.). The plans could be for any building type -- commercial, industrial, mixed-use, residential, etc. The AI should describe only what it sees, not guess a DOB classification.

**File:** `supabase/functions/analyze-plans/index.ts` (line 34)

Replace the prompt with a more versatile version:

```
You are a NYC DOB expediter assistant. Analyze these construction plans and write
a plain-text job description suitable for a DOB Project Information Sheet (PIS).

Rules:
- 1-2 sentences maximum
- No markdown formatting (no bold, headers, bullet points)
- Do NOT classify the work type -- never mention ALT1, ALT2, ALT3, Alteration Type,
  New Building, Demolition, or any DOB filing category
- Do NOT assume the building use (residential, commercial, etc.) unless it is
  clearly labeled on the plans
- Describe only the physical scope of work and the areas affected
- Use simple, professional language

Examples:
- "Interior renovation of 2nd-floor commercial space including new partitions,
   ceiling grid, plumbing rough-in for restroom, and electrical distribution.
   No change in use, occupancy, or egress."
- "Gut renovation of apartment 4A including removal of non-load-bearing
   partitions, new kitchen and bathroom layouts, and full MEP upgrades."
- "New storefront installation at ground level with structural opening in
   bearing wall, new lintel, and associated facade work."
```

This removes the ALT1 bias, avoids assuming building type, and provides varied examples.

---

### 2. Add Drag-to-Reorder for Service Line Items

**Problem:** Service rows in the proposal wizard cannot be reordered. The `useFieldArray` hook already exposes a `move` function, but it is not destructured or wired up.

**File:** `src/components/proposals/ProposalDialog.tsx`

Changes:
- Destructure `move` from `useFieldArray` (line 625)
- Wrap the service line items list in `DndContext` + `SortableContext` (already imported in the project via `@dnd-kit`)
- Add a drag handle (GripVertical icon) to each `ServiceLineItem` row, replacing the current expand/collapse chevron column with a two-icon layout (grip + chevron)
- On `dragEnd`, call `move(oldIndex, newIndex)` to reorder the form array

The `ServiceLineItem` component will be wrapped with `useSortable` from `@dnd-kit/sortable`, following the same pattern already used in `ProposalContactsSection.tsx` and `SortableSectionItem.tsx`.

**What the user will see:** A small drag handle icon on the left of each service row. Dragging a row repositions it in the list, and the proposal PDF/preview reflects the new order.
