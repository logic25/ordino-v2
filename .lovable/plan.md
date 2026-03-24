

## Plan: Improve Change Order Dialog — Work Types & Field Clarity

### Problem 1: No work type selection when adding a service
When a catalog item has `show_work_types: true`, the proposal dialog shows a work-type picker (disciplines like Plumbing, Electrical, etc.). The CO dialog ignores this entirely — it just adds the service name and price with no discipline context.

### Problem 2: "Description" field is ambiguous
The single "Description" field currently maps to three different things:
- `reason` — the full text the user types (used in CO PDF as "Reason for Change")
- `title` — auto-truncated to 80 chars from description (used as CO header title)
- `description` — auto-joined service names (never directly edited)

This is confusing. The CO document and email template use **Title** and **Reason** as distinct fields, so the form should too.

### Changes

#### 1. Split Description into Title + Reason fields
**`src/components/projects/ChangeOrderDialog.tsx`**

- Replace the single "Description" textarea with two fields:
  - **Title** (input, required) — short label for the CO (e.g., "Additional Filing Services")
  - **Reason for Change** (textarea, optional) — longer explanation shown on the CO document
- Update schema: `title` required, `reason` optional
- Update `handleSubmit` to map directly: `title → title`, `reason → reason`, `description` stays as auto-joined service names

#### 2. Add work type picker to service lines
**`src/components/projects/ChangeOrderDialog.tsx`**

- When a catalog item with `show_work_types !== false` is added, show a multi-select work type picker beneath the service line (same disciplines list used in proposals)
- Extend `COServiceLine` interface to include `work_types?: string[]`
- Store selected work types in `line_items[].work_types` so the CO document can reference them
- Update `COLineItem` type in `useChangeOrders.ts` to include optional `work_types: string[]`

#### 3. Show work types on CO PDF
**`src/components/projects/ChangeOrderPDF.tsx`**

- Under each line item name, render the selected work types as a comma-separated list in muted text (matching how service descriptions currently render)

### Files Modified
- `src/hooks/useChangeOrders.ts` — add `work_types?: string[]` to `COLineItem`
- `src/components/projects/ChangeOrderDialog.tsx` — split fields, add work type picker per service line
- `src/components/projects/ChangeOrderPDF.tsx` — render work types under line items

