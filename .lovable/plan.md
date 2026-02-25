

# Plan: Rename "Action Items" to "Tasks" + Route @mentions to Beacon

## Part A: Rename "Action Items" to "Tasks" across the UI

All user-facing text that says "Action Item(s)" will be changed to "Task(s)". Internal code identifiers (table names, query keys, hook names, file names) will remain unchanged to avoid breaking changes.

### Files to update (UI text only):

1. **`src/components/projects/ActionItemsTab.tsx`**
   - Button label: "New Action Item" → "New Task"
   - Empty state: "No action items yet" → "No tasks yet"
   - Loading text: "Loading action items..." → "Loading tasks..."

2. **`src/components/projects/NewActionItemDialog.tsx`**
   - Dialog title: "New Action Item" → "New Task"
   - Toast messages: "Action item created" → "Task created", "Error creating action item" → "Error creating task"

3. **`src/components/projects/ActionItemDetailSheet.tsx`**
   - Toast: "Action item cancelled" → "Task cancelled"

4. **`src/components/projects/CompleteActionItemDialog.tsx`**
   - Toast: "Action item completed" → "Task completed", "Error completing action item" → "Error completing task"

5. **`src/components/dashboard/MyActionItemsCard.tsx`**
   - Card title: "My Action Items" → "My Tasks"
   - Empty state: "No open action items" → "No open tasks"
   - Overflow text: "+X more items" → "+X more tasks"

6. **`src/pages/ProjectDetail.tsx`** (line 445)
   - Tab label: "Action Items" → "Tasks"

7. **`src/components/projects/ProjectExpandedTabs.tsx`** (line 686)
   - Tab label: "Action Items" → "Tasks"

8. **`src/components/chat/ChatMessageList.tsx`** (line 165)
   - Card label: "Action Item Card" → "Task Card"

9. **`src/components/settings/CompanySettings.tsx`** (lines 389, 395)
   - Description: "Post action items to..." → "Post tasks to..."
   - Sub-text: "New action items will be posted..." → "New tasks will be posted..."

10. **`src/components/assistant/AskOrdinoPanel.tsx`**
    - Suggestion: "Show me open action items" → "Show me open tasks"

11. **GChat edge functions** (user-facing strings only):
    - `gchat-interaction/index.ts`: Bot greeting text, error messages referencing "action item" → "task"
    - `send-gchat-action-item/index.ts`: Card subtitle "Action Item" fallback text

---

## Part B: Route @mention messages from gchat-interaction to Beacon

### Current behavior
The `gchat-interaction` edge function handles:
- `CARD_CLICKED` → updates action item status
- `MESSAGE` → only handles thread replies on known action item threads
- `ADDED_TO_SPACE` → sends greeting

If a message arrives that isn't in an action item thread, it returns a generic "This thread isn't linked to an action item" response.

### New behavior
Change the `MESSAGE` handler routing logic:

```text
MESSAGE received
  |
  +-- Has thread.name AND matches gchat_thread_id in project_action_items?
  |     YES → handle locally (done/status updates, same as today)
  |
  +-- NO match (or no thread / new conversation / @mention)
        → Forward full request body to Beacon webhook
        → Return Beacon's response to Google Chat
```

### Changes to `supabase/functions/gchat-interaction/index.ts`:

1. **Reorder the MESSAGE handler logic:**
   - First, check if `threadName` exists and matches a known action item thread
   - If it does, handle locally (existing code)
   - If it doesn't (or no thread), forward to Beacon

2. **Add Beacon forwarding function:**
   ```text
   async function forwardToBeacon(body: object): Promise<object>
     - POST to https://beaconrag.up.railway.app/webhook
     - Send the full original GChat event body
     - 30-second timeout via AbortSignal.timeout(30000)
     - On success: return Beacon's JSON response
     - On failure/timeout: return fallback text message
   ```

3. **Update the no-thread case** (current line 126-128):
   - Instead of returning "I can only process replies in action item threads"
   - Forward to Beacon and return the response

4. **Update the no-match case** (current lines 137-139):
   - Instead of returning "This thread isn't linked to an action item"
   - Forward to Beacon and return the response

5. **Update `ADDED_TO_SPACE` greeting** to reflect the dual role:
   - "Ordino bot is ready! I'll post tasks here as cards and answer questions about DOB filings, codes, and procedures. Reply in a task thread with 'done' to complete items, or @mention me with any question."

