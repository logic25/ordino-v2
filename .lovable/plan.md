# Add Notes tab to the real Project Detail page

## Problem
The `NotesTab` component was wired into `ProjectExpandedTabs.tsx`, but that file isn't rendered anywhere in production. The page the user actually sees at `/projects/:id` is `src/pages/ProjectDetail.tsx`, which has its own `<Tabs>` block (Services, Emails, Contacts, Timeline, Documents, Time Logs, Change Orders, Action Items, Job Costing, Research) — **no Notes tab**. So today there is nowhere in the live UI to add a note.

## Fix
1. **`src/pages/ProjectDetail.tsx`**
   - Import `NotesTab` from `@/components/projects/tabs/NotesTab`.
   - Import `StickyNote` icon from `lucide-react`.
   - Add a `<TabsTrigger value="notes">` immediately after **Services** (second tab — high visibility, matches where Sheri intuitively went looking).
   - Add a matching `<TabsContent value="notes">` rendering `<NotesTab projectId={project.id} />`.

2. **Remove the stale scaffold** — delete `src/components/projects/ProjectExpandedTabs.tsx`. It's a dead file (only self-referenced) and keeping it around will keep confusing future edits about where the real tabs live.

3. **Sanity-check `NotesTab.tsx`** — confirm it still compiles against the live `project_notes` schema (no extra changes expected; just verify after the move).

## Out of scope
- Dashboard "This Week's AI Summaries" widget.
- Showing latest note inline on project list rows.
- Migrating any legacy Ordino notes.

## Result
Sheri opens any project → sees a **Notes** tab right after Services → can type a note and hit **Add Note**, or hit **Generate AI Summary** for an on-demand status write-up. Those notes also automatically feed the weekly Monday digest and the OOO handoff that are already deployed.
