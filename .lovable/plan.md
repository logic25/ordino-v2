
# Fix Ordino: Remove Beacon Admin Pages, Fix Chat, Simplify Settings

This plan addresses all the issues identified: removing Beacon admin pages that belong on Railway, fixing the Google Chat sidebar, and simplifying the Beacon settings section.

---

## 1. Delete All Beacon Admin Pages

These pages belong on the Railway backend dashboard, not in Ordino.

**Files to DELETE:**
- `src/pages/BeaconDashboard.tsx`
- `src/pages/BeaconKnowledgeBase.tsx`
- `src/pages/BeaconBulletins.tsx`
- `src/pages/BeaconContentEngine.tsx`
- `src/pages/BeaconConversations.tsx`
- `src/pages/BeaconFeedback.tsx`
- `src/lib/beaconMockData.ts`

**Note:** `BeaconChatWidget.tsx` stays -- it's the floating Beacon chat button (Section 8).

---

## 2. Remove Beacon Routes and Nav Items

**File: `src/App.tsx`**
- Remove all 6 `/beacon/*` routes
- Remove all Beacon page imports

**File: `src/components/layout/AppSidebar.tsx`**
- Delete the entire `beaconNav` array (Dashboard, Conversations, KB, Bulletins, Content Engine, Feedback)
- Delete the "Beacon AI" sidebar section (the separator, label, and nav links)
- Remove unused imports (`Brain`, `Database`, `MessageCircle`, `Sparkles`, `ScrollText` if only used by beaconNav)
- Keep the `useIsAdmin` import (used by Settings beacon section)

---

## 3. Simplify Beacon Settings Section

**File: `src/pages/Settings.tsx`**

The current `BeaconSettingsSection` is far too complex -- it has bot identity, card templates, space management tables, and team usage tables. Replace with a simple connection status section:

- **Railway Backend URL**: Display field (placeholder URL)
- **Connection Status**: Green "Connected" indicator
- **Bot Name**: "Beacon"
- **Dashboard Link**: Button that opens the Beacon admin dashboard on Railway in a new tab
- **Quick Stats**: Total questions, avg confidence, last activity (hardcoded for prototype)
- Remove: card template toggles, space management table, team usage table, access/discovery instructions
- Remove the `import { mockBeaconSpaces } from "@/lib/beaconMockData"` (file is being deleted)

---

## 4. Fix BeaconChatWidget -- Remove beaconMockData Dependency

**File: `src/components/beacon/BeaconChatWidget.tsx`**

Currently imports `mockConversations` from `beaconMockData.ts` (which is being deleted). Replace with self-contained mock response data inline in the widget file. The widget's behavior stays the same -- floating button, slide-up panel, quick questions, confidence badges, RAG debug toggle.

---

## 5. Google Chat SpacesList -- Already Clean

After reviewing `SpacesList.tsx`, the previous fix already removed the hardcoded mock data (`mockUnreadCounts`, `mockLastMessages`). The current implementation:
- Uses real API data via props (`spaces`, `dmNames`)
- Has search bar (client-side filtering)
- Has New Chat button (`onNewChat` prop)
- Has hide/archive functionality
- Sorts by `lastActiveTime` (done server-side in edge function)

The existing implementation is already correct. The edge function enriches DM names via People API, sorts by `lastActiveTime`, and the `ChatPanel` passes real data through. No changes needed to `SpacesList.tsx`.

**Note on `search_messages`:** The Google Chat API does NOT have a `search_messages` endpoint. The edge function does not support this action. Client-side search filtering of loaded spaces (which already exists) is the available approach. Full message search would require indexing messages in our own database, which is a separate feature.

---

## Summary of Changes

| Action | File | What |
|--------|------|------|
| DELETE | `src/pages/BeaconDashboard.tsx` | Remove Beacon admin page |
| DELETE | `src/pages/BeaconKnowledgeBase.tsx` | Remove Beacon admin page |
| DELETE | `src/pages/BeaconBulletins.tsx` | Remove Beacon admin page |
| DELETE | `src/pages/BeaconContentEngine.tsx` | Remove Beacon admin page |
| DELETE | `src/pages/BeaconConversations.tsx` | Remove Beacon admin page |
| DELETE | `src/pages/BeaconFeedback.tsx` | Remove Beacon admin page |
| DELETE | `src/lib/beaconMockData.ts` | Remove mock data file |
| MODIFY | `src/App.tsx` | Remove Beacon routes + imports |
| MODIFY | `src/components/layout/AppSidebar.tsx` | Remove beaconNav section |
| MODIFY | `src/pages/Settings.tsx` | Simplify Beacon section to connection status + Railway link |
| MODIFY | `src/components/beacon/BeaconChatWidget.tsx` | Inline mock responses, remove beaconMockData import |
