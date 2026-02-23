

# Chat Improvements + Ask Ordino AI Assistant

This is a large feature set covering 4 areas: chat sidebar fixes, search/new-chat, AI assistant, and supporting infrastructure.

---

## Phase 1: Database Changes

Two new tables will be created:

**1. `hidden_chat_spaces`** -- Lets users hide/archive old chat spaces from their sidebar.
- Columns: id, user_id (references auth.users), space_id (text), hidden_at
- RLS: Users can only manage their own hidden spaces

**2. `ordino_assistant_conversations`** -- Stores Ask Ordino chat history.
- Columns: id, user_id (references auth.users), company_id (references companies), role (user/assistant), content, context_type, context_id, created_at
- RLS: Users can only access their own conversations
- Index on (user_id, created_at DESC) for fast retrieval

---

## Phase 2: Chat Sidebar Improvements

### 2A. Sort spaces by recent activity + increase enrichment limit
**File: `supabase/functions/google-chat-api/index.ts`**
- Sort unnamed spaces by `lastActiveTime` before enriching (so active chats get names first)
- Increase enrichment cap from 20 to 30
- After enrichment, sort ALL spaces by `lastActiveTime` so the most active chats appear at the top of the sidebar

### 2B. Fix bot DM names
**File: `supabase/functions/google-chat-api/index.ts`**
- Replace the DM enrichment block with smarter logic that separates human and bot members
- When there's 1 human + 1 bot (a bot DM), show the bot's name instead of the user's name
- When there are 2+ humans, pick the first one with a displayName (existing behavior, but cleaner)

### 2C. Hide/archive spaces
**Files: New hook `useHiddenSpaces.ts`, modified `SpacesList.tsx`, `ChatPanel.tsx`**
- Create a hook to fetch/manage `hidden_chat_spaces` records
- Filter hidden spaces out of the sidebar by default
- Add a hover eye-slash icon on each space row to hide it
- Add a "Show hidden" toggle at the bottom of the sidebar
- Show undo toast when hiding

---

## Phase 3: Search + New Chat

### 3A. Search bar in chat sidebar
**Files: `SpacesList.tsx`**
- Add a search input at the top of the spaces list
- Client-side filtering: instant filter of loaded spaces by displayName as user types

### 3B. New Chat button
**Files: `SpacesList.tsx`, `google-chat-api/index.ts`**
- Add a "+" or "New Chat" button next to the search bar
- Opens a dialog/dropdown that:
  - Shows recent contacts extracted from existing spaces
  - Has a search input that calls a new `search_people` action (People API directory search)
  - Selecting a person calls a new `create_dm` action (Chat API `spaces:setup`)
- Two new edge function actions:
  - `search_people`: Queries Google People API `searchDirectoryPeople` endpoint
  - `create_dm`: Creates a DM space via `spaces:setup` with the selected user

---

## Phase 4: Ask Ordino AI Assistant

### 4A. Edge function: `ask-ordino`
**File: `supabase/functions/ask-ordino/index.ts`**
- Authenticates user, gets their profile and company_id
- Classifies the question's intent using keyword matching (projects, proposals, invoices, clients, action items, calendar, RFPs, emails)
- Queries relevant tables based on intent (with company_id scoping)
- Builds a system prompt with the queried data as context
- Calls Lovable AI (gemini-2.5-flash) with the context + conversation history
- Saves both the question and answer to `ordino_assistant_conversations`
- Returns the answer, detected intents, and a summary of data queried
- Note: The RAG/knowledge-base integration will be skipped for now since no RAG function exists yet. A placeholder comment will be left for future integration.

**Important corrections from the prompt:**
- Profile table uses `display_name` not `full_name` -- will be corrected
- Action items use `status` column (not `completed` boolean) -- filter will use `status != 'done'`
- Calendar events use `user_id` referencing profiles.id, not auth.users -- query will be adjusted
- Rate limit (429) and payment (402) errors from Lovable AI will be caught and surfaced

### 4B. Frontend: Ask Ordino panel
**Files: New `src/components/assistant/AskOrdinoPanel.tsx`, `src/components/assistant/AskOrdinoButton.tsx`, `src/hooks/useAskOrdino.ts`, modified `AppLayout.tsx`**

- **Floating button**: Bottom-right corner of every page, labeled "Ask Ordino" with a sparkle/chat icon
- **Slide-out panel** (~400px wide, right side):
  - Header with "Ask Ordino", clear conversation button, close button
  - Scrollable message list with markdown rendering for clickable links
  - Text input with send button at the bottom
  - Quick prompt chips shown before first message (e.g., "Any proposals to follow up on?", "What's overdue this week?")
- **Context awareness**: When on `/projects/:id`, `/clients/:id`, etc., the page context is automatically prepended to questions
- **Session persistence**: Conversation state lives in React state (persists during navigation, resets on page refresh)

### 4C. Keyboard shortcut
**File: `AppLayout.tsx`**
- `Cmd+K` / `Ctrl+K` toggles the Ask Ordino panel
- Registered via useEffect in AppLayout

---

## Phase 5: Config + Deployment

- Add `ask-ordino` to `supabase/config.toml` with `verify_jwt = false`
- Deploy both modified (`google-chat-api`) and new (`ask-ordino`) edge functions

---

## Technical Details

### Files to create:
1. `supabase/functions/ask-ordino/index.ts` -- AI assistant edge function
2. `src/hooks/useAskOrdino.ts` -- Assistant state management hook
3. `src/hooks/useHiddenSpaces.ts` -- Hidden spaces CRUD hook
4. `src/components/assistant/AskOrdinoPanel.tsx` -- Slide-out chat panel
5. `src/components/assistant/AskOrdinoButton.tsx` -- Floating trigger button

### Files to modify:
1. `supabase/functions/google-chat-api/index.ts` -- Sort by activity, fix bot names, increase limit, add search_people + create_dm actions
2. `src/components/chat/SpacesList.tsx` -- Search bar, new chat button, hide/unhide functionality
3. `src/components/chat/ChatPanel.tsx` -- Pass hidden spaces filter, integrate search
4. `src/components/layout/AppLayout.tsx` -- Add Ask Ordino button, panel, and Cmd+K shortcut
5. `supabase/config.toml` -- Add ask-ordino function config
6. `src/hooks/useGoogleChat.ts` -- Add mutations for search_people and create_dm

### Database migration:
- CREATE TABLE `hidden_chat_spaces` with RLS
- CREATE TABLE `ordino_assistant_conversations` with RLS and index

