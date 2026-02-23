
# Beacon Admin Dashboard + Chat Enhancements

This is a large feature set that adds Beacon AI management pages alongside the existing Ordino CRM. All Beacon/Railway API calls will use **mock data** for the prototype, to be replaced with real API connections later.

---

## What Already Exists (No Changes Needed)

These features from the previous implementation are already working:
- Chat search bar (client-side filtering)
- New Chat button with directory search (People API)
- DM name resolution (enrichment via People API)
- Hide/archive spaces
- Ask Ordino AI assistant (floating panel + Cmd+K)
- AI Usage Dashboard (in Help Center)

---

## Phase 1: Mock Data Layer + Shared Types

Create a centralized mock data file that all Beacon pages share.

**New file: `src/lib/beaconMockData.ts`**
- Knowledge base files array (87 entries across all categories with title, category, last_updated, chunk_count, status, tags, has_verify_tags, content_preview)
- Buildings Bulletins array (all BBs from 2022-2026 with supersession chains, status, category, applies_to, key_takeaway, in_knowledge_base)
- Content candidates array (pipeline items with title, source, relevance_score, content_type, status, draft_content, related_questions_count)
- Sample conversations array (question, response, confidence, rag_sources, space, user, timestamp, card_type)
- Analytics summary data (daily counts, category breakdowns, confidence distribution, top questions, corrections)
- Type definitions for all data models

---

## Phase 2: Navigation Updates

**Modified file: `src/components/layout/AppSidebar.tsx`**
- Add a "Beacon" section separator in the sidebar below the existing navigation
- New nav items under "Beacon" group:
  - Beacon Dashboard (`/beacon` -- analytics overview)
  - Conversations (`/beacon/conversations`)
  - Knowledge Base (`/beacon/knowledge-base`)
  - Buildings Bulletins (`/beacon/bulletins`)
  - Content Engine (`/beacon/content-engine`)
  - Chat Management (`/beacon/chat-management`)
  - Feedback (`/beacon/feedback`)
- These are admin-only items (gated by `isAdmin` permission check)
- Keep existing "Ordino" nav items unchanged (Dashboard, Projects, Chat, etc.)
- Keep "Ordino" branding in the header -- Beacon pages are a section within Ordino

**Modified file: `src/App.tsx`**
- Add routes for all new Beacon pages under `/beacon/*`

---

## Phase 3: Beacon Dashboard (Analytics)

**New file: `src/pages/BeaconDashboard.tsx`**

KPI cards row:
- Total questions asked (this period)
- Average confidence score
- Knowledge base files (87)
- Low-confidence answers needing review

Charts:
- Questions by day (bar chart, using recharts)
- Questions by category (horizontal bar chart -- Processes, DOB Notices, Building Code, etc.)
- Confidence distribution (pie/donut -- high/medium/low)
- Top 10 most asked questions table

Knowledge Gap Analysis section:
- Table of low-confidence questions grouped by topic
- "Create Content" button linking to Content Engine
- Coverage heatmap: categories with most questions vs most content

---

## Phase 4: Knowledge Base Manager

**New file: `src/pages/BeaconKnowledgeBase.tsx`**
**New file: `src/components/beacon/KnowledgeFileCard.tsx`**
**New file: `src/components/beacon/KnowledgeFileDetail.tsx`**

Main view:
- Filter bar: category dropdown, status filter, search input
- Toggle between card grid and table view
- Each card/row shows: title, category badge, last_updated, chunk_count, status badge (active = green, needs_review = yellow)
- Orange warning icon on files with `[VERIFY]` tags
- Bulk select + "Re-ingest Selected" button (shows toast: "Re-ingestion queued for X files")
- "Re-ingest All" button in header

Detail modal/sheet (click a file):
- Full metadata (title, category, tags, source, applicable_codes, last_updated)
- Markdown content rendered with `react-markdown`
- Chunk breakdown (simulated: shows chunk boundaries)
- "Mark as Reviewed" button to clear needs_review status

Category summary cards at top showing file count per category.

---

## Phase 5: Buildings Bulletin Tracker

**New file: `src/pages/BeaconBulletins.tsx`**
**New file: `src/components/beacon/BulletinChainView.tsx`**
**New file: `src/components/beacon/BulletinDetailSheet.tsx`**

Main view:
- Filter bar: status (Active/Superseded/Rescinded), category, year, code applicability
- Table view with columns: BB Number, Title, Issue Date, Status (color-coded badge), Category, Applies To, In KB
- Status color coding: green = ACTIVE, yellow = SUPERSEDED, red = RESCINDED
- Click a row to open detail sheet

Detail sheet:
- Full BB info with key_takeaway
- Supersession chain visualization (linked list style):
  - Shows what this BB supersedes (with links)
  - Shows what superseded this BB (with link)
  - Visual arrows/connectors between BBs in the chain
- "In Knowledge Base" indicator with re-ingest button if outdated

"Most Referenced for Expediters" section:
- Highlighted card row showing the ~10 most important BBs
- Based on mock reference_count data

Alert section:
- BBs that supersede something in the knowledge base but haven't been re-ingested

---

## Phase 6: Content Engine

**New file: `src/pages/BeaconContentEngine.tsx`**
**New file: `src/components/beacon/ContentCandidateCard.tsx`**
**New file: `src/components/beacon/ContentDraftEditor.tsx`**

Pipeline tabs:
- **Incoming**: Parsed DOB updates (title, source, date, raw snippet)
- **Scored**: Updates with relevance scores (0-100 bar), impact badge, urgency badge, related team questions count
- **Drafts**: Generated content with full draft text, edit capability (textarea), approve/reject buttons
- **Published**: Published content with date, type badge (blog/newsletter/internal)

Each content card shows: title, source DOB update, relevance score, content type badge, related questions count, status

Action buttons:
- "Auto-Generate" -- shows toast "Analyzing recent questions... 3 candidates generated" and adds mock items to Drafts
- "Analyze Opportunities" -- shows a modal with gap analysis (topics where questions exist but no content)

Draft editor (click to expand):
- Full markdown editor (textarea with preview toggle)
- Metadata fields: title, content type, target audience
- Approve / Reject / Save Draft buttons

---

## Phase 7: Conversations Page

**New file: `src/pages/BeaconConversations.tsx`**
**New file: `src/components/beacon/ConversationCard.tsx`**

Main view:
- Search bar (full-text across questions and responses)
- Filter row: confidence level, card type (property lookup, filing question, code question, general), space/DM, user, date range
- Table/list of conversations:
  - User name + avatar
  - Space name or "DM"
  - Timestamp
  - Question text (truncated)
  - Confidence badge (green/yellow/red)
  - RAG sources count
  - Hallucination flag (red warning when low confidence + 0 sources)

Click to expand:
- Full question and response
- Enriched card preview (what it would look like in Google Chat with Card V2):
  - Source attribution section with relevance scores
  - Confidence indicator
  - Action buttons mockup (Correct / Wrong / See Sources / Related BBs)
  - Property Data Card (for address lookups)
  - Filing Checklist Card (for "how do I file" questions)
- "Mark as Correct" / "Needs Correction" buttons
- When "Needs Correction" clicked: textarea for correction entry, saved to mock data

---

## Phase 8: Chat Management

**New file: `src/pages/BeaconChatManagement.tsx`**

Sections:

**Deployment Status Panel:**
- Railway URL (masked), uptime badge, last restart, current model (Claude Haiku)
- Pinecone connection status (green dot), active spaces count
- All mock/display-only

**Space Management:**
- Table of Google Chat spaces Beacon is in (mock data)
- Per-space stats: questions asked, most active users, common topics

**Bot Identity Settings:**
- Display name: "Beacon" (read-only, with note about Google Cloud Console)
- Avatar URL field
- Description field

**Card Template Settings:**
- Toggle switches for each card element: source attribution, confidence indicator, action buttons, property data card, related BBs, filing checklist
- Live preview panel showing how a response would look with current settings

**Access Notes:**
- Instructions for making Beacon discoverable in Google Workspace
- Note about search limitations and Ordino Conversations page as the archive

---

## Phase 9: Feedback & Corrections

**New file: `src/pages/BeaconFeedback.tsx`**

Tabs:
- **Corrections**: Items marked "needs correction" from conversations, showing original Q&A + correction text
- **Suggestions**: Mock `/suggest` command entries
- **Tips**: Mock `/tip` command entries

Each entry shows: user, timestamp, original question, correction/suggestion text, status (pending/applied/dismissed)

---

## Phase 10: Beacon Chat (Live Test)

**New file: `src/pages/BeaconChat.tsx`**
**New file: `src/components/beacon/BeaconChatInterface.tsx`**

Full chat interface for testing Beacon:
- Message input at bottom with send button (Enter to send)
- Message thread: user messages right-aligned, Beacon responses left-aligned
- Each Beacon response shows:
  - Answer text (markdown rendered)
  - Inline confidence badge
  - Collapsible source documents with relevance scores
  - Response time
- Right sidebar panel (collapsible):
  - RAG context retrieved (what Pinecone returned)
  - Matched knowledge base files with similarity scores
  - Cache hit indicator
  - Flow type (property lookup vs RAG+LLM)
  - Raw prompt sent to Claude (collapsible, for debugging)
- Quick test buttons at top: pre-loaded questions
- Chat history: save/name conversations, switch between them
- All responses are mock data for the prototype

---

## Phase 11: Chat Sidebar Enhancements

**Modified file: `src/components/chat/SpacesList.tsx`**
- Add last message preview text and timestamp below each space name
- Add unread count badge (mock data -- random counts for demo)

---

## Phase 12: Settings Page Updates

**Modified file: `src/pages/Settings.tsx`** or new tab
- Add "Beacon" tab to existing Settings with:
  - API connection status cards (Pinecone, Voyage AI, Anthropic, Railway -- all show "Connected" with green dot, display-only)
  - Knowledge base settings (index name, embedding model, chunk size, min relevance score -- display-only)
  - Content Engine settings (auto-generate frequency, default content type)
  - Team management table (Google Chat users, correction count, suggestion count)

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/lib/beaconMockData.ts` | All mock data and types |
| `src/pages/BeaconDashboard.tsx` | Analytics overview |
| `src/pages/BeaconKnowledgeBase.tsx` | Knowledge base manager |
| `src/pages/BeaconBulletins.tsx` | Buildings Bulletin tracker |
| `src/pages/BeaconContentEngine.tsx` | Content pipeline |
| `src/pages/BeaconConversations.tsx` | Searchable conversation archive |
| `src/pages/BeaconChat.tsx` | Live test chat with Beacon |
| `src/pages/BeaconChatManagement.tsx` | Bot settings and spaces |
| `src/pages/BeaconFeedback.tsx` | Corrections and suggestions |
| `src/components/beacon/KnowledgeFileCard.tsx` | KB file card component |
| `src/components/beacon/KnowledgeFileDetail.tsx` | KB file detail sheet |
| `src/components/beacon/BulletinChainView.tsx` | Supersession chain visual |
| `src/components/beacon/BulletinDetailSheet.tsx` | BB detail sheet |
| `src/components/beacon/ContentCandidateCard.tsx` | Content pipeline card |
| `src/components/beacon/ContentDraftEditor.tsx` | Draft editor component |
| `src/components/beacon/ConversationCard.tsx` | Conversation detail card |
| `src/components/beacon/BeaconChatInterface.tsx` | Test chat UI |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add 8 new routes under `/beacon/*` |
| `src/components/layout/AppSidebar.tsx` | Add Beacon nav section (admin-only) |
| `src/components/chat/SpacesList.tsx` | Add last message preview + unread badges |
| `src/pages/Settings.tsx` | Add Beacon settings tab |

## Design Notes

- All Beacon pages use the existing `AppLayout` wrapper (same sidebar + topbar)
- Green accent color (#22c55e) used for Beacon-specific elements (confidence badges, status indicators)
- Existing Ordino branding stays; Beacon pages have a "Beacon" header/icon on each page
- All data is mock -- every API call returns hardcoded sample data matching the Railway API structure
- Mobile responsive: cards stack, tables scroll horizontally, sidebar collapses
- No new database tables needed (all mock data in TypeScript)
- No new edge functions needed (all client-side mock)
