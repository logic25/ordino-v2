

# Beacon Chat: Keep RAG Info Inline + Add Chat History

## Three Changes

### 1. Remove the admin-only RAG Debug panel and toggle button
The bottom debug panel (lines 629-651) and the toggle button (lines 486-496) are redundant — confidence, sources, and flow type are already shown inline on each message. Remove both. All users (PMs included) see the inline confidence badge and sources on every Beacon response, which is the right UX.

### 2. "New Chat" starts a new session instead of deleting history
Currently `handleNewChat` deletes all `widget_messages` from the database. Change it to:
- Add a `session_id` concept — each "New Chat" generates a new UUID stored in local state
- When loading history, only load messages for the current session
- Old sessions are preserved in the database

### 3. Add a "Previous Chats" panel to browse old sessions
When the user clicks a new icon (e.g., a clock/history icon) in the header:
- Query `widget_messages` grouped by session, showing the first user message as the preview
- Clicking a session loads those messages into the chat view (read-only or resumable)

## Technical Details

### Database migration
```sql
ALTER TABLE widget_messages ADD COLUMN session_id uuid DEFAULT gen_random_uuid();
```

### File: `src/components/beacon/BeaconChatWidget.tsx`

**Remove:**
- `showDebug` state and the debug toggle button in the header (lines 486-496)
- The entire debug panel div (lines 629-651)

**Add:**
- `sessionId` state — initialized with `crypto.randomUUID()`, reset on "New Chat"
- `showHistory` state for the history panel toggle
- History icon button in header (between New Chat and Close)
- `handleNewChat` — just resets `sessionId` + clears local messages (no DB delete)
- Pass `sessionId` when saving messages to `widget_messages`
- Load history filtered by `session_id` on mount

**New component: `BeaconChatHistory`** (inline or separate file)
- Queries distinct sessions: `SELECT DISTINCT session_id, MIN(created_at), MIN(content) FROM widget_messages WHERE user_email = ? AND role = 'user' GROUP BY session_id ORDER BY MIN(created_at) DESC`
- Renders a list of past sessions with timestamp + first message preview
- Clicking a session sets `sessionId` to that value, triggering history reload

### File: `src/services/beaconApi.ts`
- No changes needed — session_id is a DB concern, not an API concern

### Files Changed
| File | Change |
|------|--------|
| `widget_messages` table | Add `session_id` column |
| `src/components/beacon/BeaconChatWidget.tsx` | Remove debug panel/button, add session management, add history panel |

