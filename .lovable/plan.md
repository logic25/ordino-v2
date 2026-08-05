# KB Gaps: include Google Chat questions, not just the web widget

## What's happening today

The KB Gaps tab reads `beacon_interactions` directly and does not filter by channel — so Google Chat rows are already in the query. They almost never qualify as gaps because of how a gap is detected:

- A row only counts when `confidence < 0.5` **and** the answer contains one of six phrases ("don't have", "not in my documents", ...).
- Chat answers score higher. Example from a Google Chat space: *"Hey guys! In your experience, does the job # need to be listed on the ACP-5?"* — Beacon replied *"The knowledge base doesn't have specific guidance on…"* at confidence **0.73**. A real, self-declared miss, silently dropped by the 0.5 threshold.
- Everything currently listed comes from the web widget (questions prefixed `[Page: …]`), which is why the tab looks like a widget-only report.

There are 195 web interactions and ~20 chat/space interactions in the window, so chat volume is small but the misses are the high-value ones.

## Plan

### 1. Detect a gap by signal, not by threshold alone
A question counts as a gap when either:
- Beacon's answer explicitly says the knowledge base lacks it (expanded phrase list: "doesn't have specific guidance", "not in the knowledge base", "documents don't contain", "no guidance on", plus the existing six), regardless of confidence; **or**
- confidence is below 0.5 and the answer isn't a clean, sourced response.

Keep the existing noise filters (slash commands, greetings, very short questions, test pings).

### 2. Label and filter by where the question was asked
Derive a source from `space_name`:
- `ordino-web` → **Web widget**
- `spaces/…` → **Google Chat**
- `ordino-chat` → **Ordino chat panel**
- anything else / test spaces → **Other**, and drop obvious test spaces (`test`, `spaces/TEST123`, `DIAGNOSTIC_FAKE`, etc.) from the list.

Show the source as a badge on each gap line and add a source filter (All / Web widget / Google Chat / Ordino chat) at the top of the tab, plus a per-topic count of how many gaps came from chat.

### 3. Clean up how questions read
Strip the `[Page: Documents]` prefix into a small muted context chip instead of leaving it inline in the quoted question, so widget and chat gaps look consistent side by side.

Marking addressed, Teach, and Docs actions stay exactly as they are.

## Technical notes

- All changes are in `src/components/beacon/BeaconKbGaps.tsx`: widen `GAP_PHRASES`, rework `isGap` into a two-branch rule, add a `sourceOf(space_name)` helper, select `space_name` in the existing query, and add badges/filter to the render.
- No backend, schema, or edge-function change — `beacon_interactions` already carries `space_name` and every channel writes to the same table.
- Changelog entry added for the widened gap detection.
