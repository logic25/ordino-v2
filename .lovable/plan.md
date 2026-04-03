

# Add Delete for Beacon Chat History (Revised)

## Changes

### 1. Database: Soft-delete column
Add `deleted_at timestamptz` to `widget_messages`. Add UPDATE RLS policy so users can soft-delete their own messages.

### 2. `src/components/beacon/BeaconChatWidget.tsx`
- **Session row**: Show a small trash icon on **hover** (right side of each row) — no swiping
- **Delete handler**: Sets `deleted_at = now()` on all messages in that session
- **Inline confirm**: First click shows "Delete?", second click confirms — no modal
- **"Clear All" link**: At top of history panel to delete all sessions at once
- **Filter**: Add `.is("deleted_at", null)` to all `widget_messages` queries

## Files Changed

| File | Change |
|------|--------|
| `widget_messages` table | Add `deleted_at` column + UPDATE RLS policy |
| `src/components/beacon/BeaconChatWidget.tsx` | Hover trash icon per session, Clear All, filter deleted |

