## Revised plan — three parts

### Part 1 — DO NOT ingest published posts into the Beacon KB

Drop the entire publish→KB workstream from the prior plan. Concretely, nothing to build:

- `supabase/functions/publish-to-blog/index.ts` stays exactly as it is (marketing-site POST + status updates). No `/api/ingest` call.
- No new columns on `generated_content` (`beacon_ingest_status`, `beacon_source_file`, `beacon_ingested_at`, `beacon_ingest_error`).
- No new `published_content` folder or `published_post` source_type mapping in `FOLDER_TO_SOURCE_TYPE`.
- No backfill/reingest path for the two existing published posts.
- No "Retry Beacon ingest" affordance in the UI.

Rationale is codified in the code comment I'll add above the marketing-site POST in `publish-to-blog/index.ts` so a future contributor doesn't reintroduce it:

> Do NOT pipe published posts into the Beacon KB. The KB must hold only authoritative primary sources (DOB rules, code, our real documents). Ingesting our own generated posts creates a self-referential loop — the model would cite its own prior output as authoritative and any error would seed the next post. Direction is one-way: KB validates posts; posts never feed the KB.

Publish flow to the marketing site is otherwise unchanged.

---

### Part 2 — KEEP: KB-grounded generation with fact-flagging

**Railway (`/api/content/generate`) — you apply the prompt/tooling diff:**

- Retrieval order per section: (a) source signal from `topics` + `reasoning`, (b) Beacon KB RAG over Pinecone at min-confidence ~0.72, (c) general knowledge for structure/explanation only — never for specific facts.
- Fact-guard: any dollar amount, deadline/duration, percentage, code section (`BC/MC/AC/NYCECC \d+(.\d+)*`), form number (`PW1/PW2/PW3/TR1/TR8`), or specific date must either be backed by a retrieved chunk ≥ threshold (cite `source_file` inline) or emitted as `[[VERIFY: <missing fact>]]`.
- Return alongside `content`:
  ```json
  { "grounding": { "kb_sources": [{"source_file": "...", "score": 0.81}], "verify_flags": ["filing fee for PW1 renewal", "..."], "kb_confidence_avg": 0.74 } }
  ```

**Ordino side:**

1. **DB migration** — add one column:
   - `generated_content.grounding jsonb null` (no policy changes needed — inherits existing RLS + grants).

2. **`src/hooks/useContent.ts`**:
   - `useGenerateDraft` / `useQuickGenerate`: enrich the request body with `topic_confidence` (avg confidence of the matching cluster from `useContentGaps` data), `topic_question_count`, and `low_confidence_topics` (all gap clusters where `avg_confidence < 0.6`). Fetched inline via a lightweight query so the gate isn't rendering-dependent.
   - Persist the returned `grounding` object into `generated_content.grounding` on insert. Also mirror `kb_confidence_avg` into the same row for cheap querying.
   - New util `applyClientFactGuard(content, grounding)`:
     - Regex hits (conservative): `\$[\d,]+(?:\.\d+)?`, `\b\d+\s*(?:business\s+)?days?\b`, `\b\d+\s*months?\b`, `\b\d+%`, `\b(?:BC|MC|AC|NYCECC)\s*\d+(?:\.\d+)*\b`, `\bPW[123]\b`, `\bTR[18]\b`.
     - Skip if the hit is already inside `[[VERIFY:…]]` or is followed by an inline `(source: …)` citation marker the Railway prompt emits.
     - For each remaining hit, check whether the literal token appears in any `grounding.kb_sources[].source_file` retrieved-chunk excerpts (returned inline in `grounding` — extend Railway payload to include a short `excerpt` per source). If not present → wrap the enclosing sentence in `[[VERIFY: <fact>]]`.
     - Runs after `stripEditorialPlaceholders` on the freshly returned draft, before the `insert`.

3. **`src/pages/Content.tsx` PreviewDialog**:
   - Extend the existing amber banner: in addition to `[[CONFIRM:…]]` matches, list all `[[VERIFY:…]]` occurrences with the flagged fact text.
   - Per-flag action **"Replace with KB lookup"** → opens a small dialog running `askBeacon(<flag text> + surrounding sentence, …)` scoped to the flagged fact; the returned answer + top source can be inserted back into the draft (replacing the `[[VERIFY:…]]` span) or copied.
   - New grounding pill next to the title: pulls `grounding.kb_confidence_avg`.
     - ≥ 0.7 → emerald "Grounded • {n}% avg KB confidence"
     - 0.4–0.7 → amber "Partially grounded • {n}%"
     - < 0.4 or missing sources → red "Weakly grounded • {n}%"
   - Extend the existing publish-blocking regex to also match `[[VERIFY:…]]`. Same server-side guard in `publish-to-blog` — one extra alternation in the regex, no new code path.

---

### Part 3 — Replace "Beacon citations per post" with "Post performance" + "Grounding health"

**`src/components/content/ContentAnalyticsTab.tsx`** and `src/hooks/useContentAnalytics.ts`:

1. **Remove** the `⭐ Beacon citations per post` panel entirely.
2. **Remove** `usePublishedPostAnalytics` (the citation counter). AI-cost display (currently on that same row) moves into the new Grounding health card so we don't lose it.
3. **Add "Post performance" panel** (external engagement, per published post):
   - Columns: Post title · Published date · Page views · Contact conversions (CTA/phone clicks) · Search impressions · Search clicks.
   - Data source: Google Analytics 4 + Google Search Console — neither is wired yet.
   - Detection: check for a `google_analytics` connector + a Search Console verified property for the marketing site domain. Until both are connected, render an honest empty state card with two "Connect…" buttons that open the respective connector flows:
     > "Connect Google Analytics & Search Console to see how each post is performing — page views, contact conversions, and search impressions. Until then we can't measure external engagement honestly."
   - Do **not** show fabricated 0s, dashes, or placeholder rows. Zero fake data — just the connect prompt.
   - Once connected, per-post lookup uses the post's marketing-site URL (already persisted as `generated_content.published_url`) against GA4 `pagePath` and Search Console `page` dimensions.

4. **Add "Grounding health" panel** (internal content quality — the honest replacement for the removed metric):
   - Tiles across all published posts:
     - **Avg KB confidence at generate time** — mean of `grounding.kb_confidence_avg`.
     - **% clean drafts** — share of published posts where `grounding.verify_flags` was empty at generate time.
     - **Verify flags resolved before publish** — count of `[[VERIFY:…]]` inserted by generator/fact-guard that were edited out before Publish (delta between `grounding.verify_flags.length` and any remaining matches in the final `content`).
   - Per-post breakdown row: KB confidence pill + verify-flags-at-generate count + AI cost (relocated from the removed panel).
   - Empty state when no published posts have a `grounding` row yet: "Grounding metrics start once posts generated with the new pipeline are published."

Author & source mix panel and Content gaps panel are unchanged. SEO outbound card stays.

---

## Files touched

- `supabase/migrations/<timestamp>_add_generated_content_grounding.sql` — one `alter table … add column grounding jsonb`.
- `src/hooks/useContent.ts` — enrich generate request, persist `grounding`, run `applyClientFactGuard`.
- `src/pages/Content.tsx` — extend banner for `[[VERIFY:…]]`, per-flag askBeacon action, grounding pill, publish-guard regex.
- `supabase/functions/publish-to-blog/index.ts` — add non-ingest comment; extend placeholder regex to include `VERIFY`.
- `src/components/content/ContentAnalyticsTab.tsx` — remove citations panel, add Post performance (with GA4/GSC connect empty state) + Grounding health panels.
- `src/hooks/useContentAnalytics.ts` — remove `usePublishedPostAnalytics`; add `useGroundingHealth` and a `usePostPerformance` hook that returns `{ connected: false }` until GA4/GSC connectors are present.

## Out of scope

- Ingesting anything into the Beacon KB from the app side.
- Actually wiring GA4/GSC — Post performance ships with the empty-state connect prompt; live data flip-on is a separate task once the connectors are added.
- Rewriting previously-published posts to backfill `grounding` (they'll show as "—" in the per-post row).
- Any responsiveness/layout changes.
