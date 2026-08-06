# Beacon vs LLM — a measurable moat tab

Add a "Beacon vs LLM" tab to the Beacon Hub that runs the same question through Beacon (knowledge-base grounded) and a strong frontier model with no GLE knowledge, side by side, plus a scoreboard across a fixed question set.

## What I'd change about the ask

Three honest corrections based on how Beacon is actually wired:

1. **Mode 1 as specified isn't achievable today.** Beacon runs on the external Railway RAG service (`/api/chat`), and that endpoint has no "KB off" switch — nothing in Ordino exposes Beacon's underlying model or lets us call it without retrieval. So "same model, with vs without the KB" cannot be run literally. I'd ship it as **"KB-off control"**: the same question against a strong frontier model with retrieval removed, labeled plainly as an approximation ("control model, not Beacon's exact weights"). A true same-model A/B needs a `kb: false` flag added on the Railway side — worth requesting, and the UI will light up the honest version the moment it exists. Faking it would poison the exact metric you're building.
2. **Comparison model.** `google/gemini-2.5-pro` is available, but the strongest available frontier model in the stack is `openai/gpt-5.5`. Using the strongest one makes a Beacon win mean something. I'd default to GPT-5.5 with a dropdown to swap to Gemini 2.5 Pro, so nobody can claim we picked a weak opponent.
3. **Add one more column beyond "has sources".** Source-count alone is gameable — Beacon always cites something. I'd also record **specificity**: did the answer name a concrete DOB form, code section, fee, or timeline the generic model didn't? That's computed by a cheap grep for form/code patterns (PW1/PW2/TR1, "AC 28-…", "§", "$", day counts) on both answers, so the scoreboard reports "Beacon named N specifics the generic model didn't" alongside coverage. Still a coverage signal, not correctness — banner says so.

## What gets built

**New edge function `compare-answers`** (read-only, JWT-validated like the rest):
- Input: `{ question, mode, genericModel }`.
- Fans out in parallel to Beacon (`beacon-proxy?action=chat`) and to the Lovable AI Gateway frontier model with an explicit "you have no access to Green Light Expediting's internal knowledge; answer from general knowledge only, and say so if unsure" system prompt.
- Returns `{ beacon: { answer, sources, confidence, response_time_ms }, generic: { answer, model, response_time_ms }, delta: { beaconSources, genericSources: 0, beaconSpecifics, genericSpecifics } }`.
- Streams the frontier call server-side (GPT-5.5 goes through the Responses API) so long answers don't time out.
- Surfaces 429/402 gateway errors to the UI instead of hiding them.

**New tab `Beacon vs LLM`** (admin-only, alongside Usage/Config/KB Gaps):

```text
[ Ask one question ]  [ Scoreboard ]        model: [ GPT-5.5 ▾ ]

question input ......................................  [ Compare ]

┌ Beacon (KB-grounded) ─────────┐ ┌ Frontier AI (no GLE knowledge) ┐
│ answer                         │ │ answer                         │
│ sources: 3 · confidence 0.82   │ │ sources: none                  │
└────────────────────────────────┘ └────────────────────────────────┘

WHAT BEACON ADDS
cited 2 GLE guides + 1 DOB notice · named PW1, §28-104.7, 10-day window
the frontier model cited nothing and hedged
```

- **Ask one question**: single question, two answer cards, "What Beacon adds" strip underneath listing Beacon's cited sources and the specifics only Beacon named.
- **Scoreboard**: ~15 hardcoded real GLE questions, run sequentially with a progress bar, showing the headline "Beacon cited real GLE knowledge on X% of questions the generic model couldn't" plus a table of question · Beacon sources? · generic sources? · specifics delta. Results live in component state only — nothing is written to the database.
- Persistent honesty banner: sources are a **coverage** signal, not a correctness proof; correctness needs the separate expert backtest.

## Technical notes

- `supabase/functions/compare-answers/index.ts` — new; JWT check via `getClaims`, CORS headers, no DB writes.
- `src/services/beaconApi.ts` — add `compareAnswers()` wrapper.
- `src/components/beacon/BeaconVsLlmPanel.tsx` — new panel (two sub-modes, answer cards, delta strip, scoreboard table).
- `src/components/beacon/compareQuestions.ts` — the 15 seed questions (pulling from `beacon_interactions` is a later step; the file is the single place to swap in).
- `src/pages/BeaconHub.tsx` — register the tab, admin-gated.
- Frontier calls use the Lovable AI Gateway; no new secrets, no new auth, no schema changes.
- Changelog row inserted on completion, per project convention.
