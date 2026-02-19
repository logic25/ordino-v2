
## Project Readiness Color Coding

Add visual color differentiation to the Project Readiness cards based on three states:

### States and Colors

| State | Condition | Border Color | Left Accent | Icon |
|-------|-----------|-------------|-------------|------|
| **Complete** (100%) | All checklist items received | Green border | Green left bar | CheckCircle2 (green) |
| **In Progress** (1-99%) | Some items received | Amber/yellow border | Amber left bar | Clock (amber) |
| **Not Started** (0% or no items) | No checklist items at all | Default/gray border | No accent | Circle (muted) |

### Changes

**File: `src/components/dashboard/PMDailyView.tsx`**

1. Add a left border accent and conditional border color to each readiness card based on `readyPercent`:
   - `readyPercent === 100` --> green left border, subtle green background tint
   - `readyPercent > 0` --> amber left border, subtle amber background tint
   - `readyPercent === 0` or no checklist --> neutral/gray, no accent

2. Add a small status icon next to the project name matching the state color

3. Group the readiness items by state (complete at bottom, not started at top) so the ones needing attention are most visible -- this aligns with the current sort by `readyPercent` ascending

### Technical Details

- Use Tailwind classes like `border-l-4 border-l-green-500`, `border-l-amber-500`, `border-l-border` for the left accent
- Add subtle background: `bg-green-500/5`, `bg-amber-500/5` for complete/in-progress
- The existing progress bar colors already differentiate (green/amber/red) -- this extends that visual language to the whole card
- No database changes needed; purely a UI update
