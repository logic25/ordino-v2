
## Three Issues to Address

### Issue 1 — "No Telemetry Data" (Analyze Behavior)

**Root cause confirmed:** The `telemetry_events` table has 0 rows. The `useTelemetry` hook is wired into ~24 files and pages but these events are only recorded as users interact with the live app going forward. The "Analyze Behavior" tab is working correctly — it honestly tells you there's no data yet.

**Fix — Clarify the message in the UI:**
Instead of a cold "No telemetry data found", show a more informative state that explains:
- Telemetry starts collecting from today onwards
- It needs ~a week of real usage before patterns emerge
- Optionally show which pages are being tracked so users know it's working

No edge function changes needed.

---

### Issue 2 — Merge "Add Item" with AI Stress-Test

**Current state:** Two separate flows:
- "Add Item" button → plain form, saved manually
- "AI Intake" button → separate modal with tabs (Analyze Behavior + Stress-Test Idea)

**Proposed change — Replace "Add Item" with "Add Idea":**

The new "Add Item" dialog will have two modes toggled inline:

```
[ Quick Add ]  [ AI Stress-Test ]
```

**Quick Add tab (existing behavior):** Fill in title/description manually, save directly.

**AI Stress-Test tab (new behavior):**
1. User types the idea in plain English (textarea)
2. Clicks "Stress-Test & Add" button
3. AI runs the analysis (same `analyze-telemetry` edge function, `mode: "idea"`)
4. Results shown inline (evidence, challenges, duplicate warning, suggested priority/category)
5. User can adjust priority/category/status, then click "Add to Roadmap" — saves with `stress_test_result` and `stress_tested_at` pre-populated
6. The card will immediately show the ✨ AI tested badge on the Kanban board

This collapses the "AI Intake → Stress-Test an Idea" tab entirely into the main Add flow, making it feel natural. The "AI Intake" button can be renamed to "Analyze Behavior" and made to open only the telemetry analysis tab (no more two-tab modal needed).

---

### Issue 3 — AI Actor / Avatar for Demo Videos

**Direct answer:** Yes, one tool does this well:

**HeyGen** (heygen.com) — You can:
1. Create a custom AI avatar that looks and sounds like a real person (or use a stock avatar)
2. Type a script or paste text, the avatar reads it on screen
3. Record your screen and have the avatar explain it in a floating window

This is the only tool in the list with a full AI avatar + screen recording combo. The others:
- **Loom** — Real camera only, no AI actor
- **Arcade / Supademo** — Interactive walkthroughs, no avatar
- **Guidde** — AI voiceover but no on-screen avatar

The `videoUrl` field in "What's New" already supports any URL including HeyGen-exported links or Loom embeds, so no code changes are needed there.

---

## Technical Changes

### Files to change:

**1. `src/components/helpdesk/ProductRoadmap.tsx`**
- Replace the current "Add Item" button behavior with a two-tab dialog ("Quick Add" / "Stress-Test & Add")
- The stress-test tab: textarea → run analysis inline → show result → confirm save with pre-populated AI data
- Rename the "AI Intake" button to "Analyze Behavior" and wire it to open a simplified modal (telemetry tab only)
- The ✨ AI badge already exists in `SortableRoadmapCard` — it will show automatically for items stress-tested through the new flow

**2. `src/components/helpdesk/AIRoadmapIntake.tsx`**
- Remove the "Stress-Test an Idea" tab (now lives in the Add Item dialog)
- Rename/simplify to `AnalyzeBehaviorModal` with only the telemetry analysis tab
- Improve the "no data" empty state to explain the collection timeline with a checklist of tracked pages

**3. `supabase/functions/analyze-telemetry/index.ts`**
- No changes needed — already handles `mode: "idea"` correctly

### UI Flow Diagram

```text
Roadmap Page
├── [Analyze Behavior] button → Opens modal (telemetry only)
│   └── "No data yet" → Better empty state with tracked pages list
│       and "check back in ~1 week" messaging
│
└── [+ Add Item] button → Opens dialog with two tabs
    ├── Quick Add tab (title/desc/category/status/priority → Save)
    └── Stress-Test tab
        ├── Textarea: describe your idea
        ├── [Stress-Test & Add] → calls analyze-telemetry (mode=idea)
        ├── Shows: evidence, priority, category, challenges, duplicate warning
        ├── Editable: status, priority, category dropdowns
        └── [Add to Roadmap] → saves with stress_test_result + stress_tested_at
            → Card shows ✨ AI tested badge immediately
```
