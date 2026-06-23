## What broke
The "Teach Beacon" edit to `supabase/functions/beacon-proxy/index.ts` left the new admin/manager passthrough `if (action === "get_kb_gaps" || action === "dismiss_kb_gap" || action === "update_feedback_roadmap") { ... }` block (lines 130–166) without its closing `}`. As a result, every subsequent action handler (`chat`, `ingest`, `knowledge-list`, `file-content`, `content-generate`, and the final `else`/dispatch) is syntactically nested inside that `if`. Any non-Teach action falls through to the `fetch(beaconUrl!, ...)` at line 768 with `beaconUrl` undefined and errors out, which is why the Documents → Beacon Knowledge view shows "Beacon API Unreachable" (the upstream Railway service is fine — I curl'd it and it returns 200).

Brace audit of the file: 341 open `{` vs 340 close `}` — exactly one missing.

## Fix
Add the missing `}` to close the `if (action === "get_kb_gaps" || ...)` block right after its `return new Response(...)` at line 166, before the blank lines preceding `let beaconUrl`.

Concretely, change:

```
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });


    let beaconUrl: string;
```

to:

```
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let beaconUrl: string;
```

That's the entire fix — one character. Deploy is automatic.

## Verify
1. `curl` `beacon-proxy?action=knowledge-list` with a valid session — expect 200 + folder list (not 401/500).
2. Reload `/documents` → Beacon Knowledge Base view → folders/files render instead of the unreachable error.
3. Confirm the Teach Beacon tab still works (gaps load, dismiss works) — same code path, just now properly scoped.

## Not changing
- No frontend changes.
- No other edge function or RLS changes.
- No revert of the Teach Beacon work — it stays, just correctly braced.

---

# Beacon Agents (Parked Roadmap)

A running section grouping AI-agent ideas that share the same archetype: **Beacon + Ordino data + a specific workflow, human-reviewed**. All are parked until prerequisites are met.

## Shared prerequisites
1. Beacon hardened and trusted (KB gaps closed, teaching loop working, accuracy proven).
2. Human-in-the-loop review required for every agent action — no autonomous writes.
3. Clear input pipeline chosen per agent (no in-house commodity layer).
4. Consent / audit / rollback policy in place.

## Shared anti-pattern (do NOT build)
Never build the commodity layer underneath these agents:
- Filing Agent → don't build DOB-NOW submission.
- Lead → Proposal Agent → don't build a pricing engine.
- Meeting Intelligence → don't build transcription/summarization (use Google Meet/Gemini notes).

The moat is the **thin differentiated layer** that only works because Beacon reads Ordino.

## Agents

### 1. Filing Agent
Cross-references filing requirements against project state; surfaces missing docs, stale filings, and next-action gaps. Human PM approves before submission to DOB-NOW (which stays manual or via existing Railway agent).

### 2. Lead → Proposal Agent
Takes a qualified lead + Ordino historical pricing/scope and drafts a proposal skeleton (services, fees, narrative) for PM review. Does NOT auto-send; does NOT replace pricing judgment.

### 3. Meeting Intelligence (Beacon Meeting ↔ Ordino)
Ingests meeting notes/transcripts from Google Meet / Gemini notes and cross-references them against live Ordino data — projects, action items, invoices, leads. Surfaces gaps:
- Unfulfilled commitments ("you said you'd file Rudin ALT-2 this week — still not_started")
- Decisions discussed but not logged
- Projects raised in meeting but stalled (no activity in N days)
- At-risk clients mentioned vs. their real status (overdue invoices, etc.)
- Action items never converted to tasks

**Do NOT build:** transcription/summarization. Consume Google Meet/Gemini output.
**Depends on:** Beacon trusted; meeting-notes input pipeline chosen; consent/recording policy.

## Next agent candidates
Add new ideas here as one-liners; promote to a numbered entry once scoped.
