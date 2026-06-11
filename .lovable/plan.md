## Goal
Let you update many projects at once from the Projects list (especially within a Group-by-Client / Group-by-Address group), without opening each one.

## What you'll get

**1. Inline status editor (single-row)**
The Status column becomes a small dropdown (Open / On Hold / Closed / Paid) — same pattern PM already uses. One click to change. No dialog.

**2. Bulk select + bulk action bar**
- Checkbox on every row + a header checkbox per group ("select all in this group") and a master checkbox on the table.
- When 1+ rows are selected, a sticky action bar appears at the bottom with the count and three actions:
  - **Set status →** Open / On Hold / Closed / Paid
  - **Assign PM →** picker of teammates (or Unassigned)
  - **Clear selection**
- Updates run as a single Supabase `update ... in (ids)` call, then React Query invalidates so the list/cards/totals refresh.

**3. Works with grouping**
Each group header gets its own "select all in group" checkbox so you can, e.g., select every open project for one client and reassign the PM in one click.

## Out of scope
- Bulk delete (destructive — keep per-row for now).
- Editing project name / value / property inline (those still open the project).
- Changing visibility rules — All Projects toggle stays as just-shipped (everyone can see it, defaults to All).

## Files touched
- `src/components/projects/ProjectTable.tsx` — add row checkbox column, inline status Select, accept `selectedIds`/`onToggleSelect`/`onToggleGroup` props.
- `src/pages/Projects.tsx` — selection state, group-header checkbox, sticky `BulkActionBar`, mutation handler.
- New `src/components/projects/BulkActionBar.tsx` — the floating bar (status dropdown, PM dropdown, count, clear).
- `changelog_entries` — one row: "Bulk-update projects from the list."

No DB migration needed; existing `projects` RLS already covers updates.
