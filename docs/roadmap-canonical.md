# Ordino / Beacon / GLE — CANONICAL ROADMAP (truth doc)

*Verified 2026-08-05. Every **actionable** item (🔨 In Progress / ⬜ Not Started) carries a real description — what it is, why it matters, how/status — so you can work straight off this. Completed items are one-liners (done + verified). Strategy/North-Star at the bottom.*

Legend: ✅ done & verified · 🔨 in progress · ⬜ not started · ⏸️ blocked/deferred · 🔴 top priority

---

## AREA 1 — BEACON (KB, RAG, answering quality)

### ✅ Completed
1. Security lockdown — auth-gated ingest/read/chat, SSRF egress guard, constant-time HMAC.
2. Boot-crash fix (`97c018c`) — shadowed `import os` in `initialize_app`.
3. KB phantom/duplicate manifests resolved (delete-fix `a27ea1f` + prune `be1c23a`); FDNY phantom cleared.
4. "Guesses instead of retrieving" / TR2 root cause (`affcadf` + `c8e6d7f`) — form-code forces RAG + rerank.
5. **Reason-first / over-deferral fix** (`d519580`) — verified live (answers + labels, no reflexive punt).
6. **Numeric-grounding / fee-faithfulness rule** (`bec47b3`) — verified live.
7. Manifest hygiene; supersession engine; 32 SNs + 22 BBs pulled; email flywheel; newsletter link-crawl (`bd89e96`); forward-to-teach (`e64eee7`).
8. DOB Open Data tools (`341cf1c`); `who_do_we_know` (`d4d512d`); `enrich-signal` (`01b54d4`); clean BD events (`0b0ae80`); KB-noise fix (`571fad8`).
9. Objection `.zip`/`.xlsx` upload path (XML parser) + **23 real exports ingested** (~185 total).
10. Fee thread closed — grounding rule + authentic Feb-2026 Service Notice (real nyc.gov source) + Admin Code Table 28-112.2.
11. **KB attribution fixed** (`cac009e`) — `rebuild-manifest`/re-ingest preserve `uploaded_by`+dates; backfilled Chris/Manny; grid display shipped by Lovable.
12. **Signals link-crawl + Sonnet enrichment** (`7ac7ac0`) — crawls article links, reasons with Sonnet, adds "why"+address (verbatim, no hallucination), returns full story text.

### 🔨 In Progress
1. **Objection corpus growth** — the moat. Chris exports DOB NOW objections per job → they get ingested as pattern docs ("what this work type gets flagged for + how GLE resolved it"). Now ~185; grows batch-by-batch (DOB NOW session kick-outs make it incremental). *Intake is the new `.zip`/`.xlsx` upload path.*
2. **Chris's 6 held guides** — the head-to-head/supersede cases from his 26-guide batch (Full Demolition, Energy/NYCECC, EESE/Green Roof/Solar, Antenna & Curb Cut, BPP, TPP/SSP). Decision list delivered (`Chris-Guides-Decision-List.md`); **awaiting Chris to mark each.** Supersede cases = **edit the existing doc in place** in Ordino (it re-embeds), not re-ingest.
3. **Clickable sources – Phase 1** — make Beacon's "Source: …" line a real hyperlink using the `source_url` already in each official doc. Works in Chat *and* the widget. **Why:** every answer becomes verifiable (the fee thread proved a plain-text source is uncheckable). *Not built.*
4. **Jurisdiction filter / coverage-aware answering** — the retriever already accepts a `jurisdiction_filter` (~90% built); wiring it lets Beacon answer from *real coverage* ("no coverage for X yet") instead of NYC-only refusal — the expansion mechanism. **Rollout order matters:** backfill-tag the corpus NYC first, THEN turn the filter on, or retrieval returns ~zero. Fairfax is the pilot.
5. **Beacon model routing** — route hard questions (ACP-5, reasoning, BD) up from Haiku → Sonnet. Team is small, cost trivial → smarter default answers. Pairs with the reason-first fix. *(Signals extraction already bumped to Sonnet today.)*
6. **Revive 👍/👎 feedback** — it existed but fell off when answers were often wrong; now that answers are better, re-enable it AND wire 👎 into the KB-gap loop (a downvote = "review + fix this"). *(GChat 👎/`/correct` already works — verified in the Office Staff space.)*

### ⬜ Not Started
1. **Reference-miner** — the BB/SN completeness audit (read-only). (1) read each guide, pull every `BB 20XX-XXX`/SN/`RCNY §` it cites; (2) validate each vs the KB's Master Index (current vs superseded); (3) find bulletins that govern the guide's topic but it doesn't cite. Output per guide: ✅ cited & current / ⚠️ cited-but-superseded / ➕ relevant-but-missing. **Why:** shows which guides are stale AND which BBs are worth ingesting (only the ones guides should reference — not all hundreds). TR2 bulletins were the pilot hit.
2. **DOB Service-Notice freshness loop** — auto-ingest new DOB Service Notices as they're posted (the notice page URL is already in the fee doc's frontmatter). **Why:** keeps fees/rules current on their own, so the grounding rule always has fresh data — the answer to "what happens in a year when DOB changes it." Same pattern as the objection loop.
3. **`beacon-qa` retirement** — route everything to Railway `/api/chat` (the 13-tool Claude superset) and drop the weaker Supabase edge-fn brain. Gate: audit `beacon-data-proxy` first (Area 6 #1).
4. **Clickable sources – Phase 2** — a Supabase Storage bucket for GLE's *internal* docs (guides/SOPs) so a Google Chat user (not in Ordino) can click through to them. Official docs need no bucket (Phase 1 uses their nyc.gov `source_url`).
5. **EBC (Existing Building Code)** — ingest the DOB EBC newsletter series as released, tagged "not yet in force" (effective 2027-07-17) so it never contaminates current-code answers. Then build a current-code-vs-EBC diff for GLE's common filings — a Beacon capability + a marketing asset (GLE = EBC-ready early).
6. **KB correction — "what's a PAA"** — drop the false Minor/Major split + the "can't affect structural/egress/occupancy" restriction (those were Directive-14 criteria). A PAA amends *any* change to an approved app; the real recent constraint is the substantial-re-examination fee (Nov-2025 notice).
7. **Trim the every-~25s Pinecone `describe_index_stats`** — cause: `/health` runs `get_stats()` on every uptime ping (verified). Fix: make `/health` a cheap liveness check; move the doc-count to `/api/status` or cache it. Cost/noise only.
8. ⏸️ **Drive objection poller** — fully-automatic version of the objection intake. **Blocked** on a Workspace-admin step (add the Drive scope to the service account's domain-wide delegation). Deferred — the `.zip` upload path covers intake now.

---

## AREA 2 — THE MOAT (objection intelligence)

### ✅ Completed
1. Objection loop live — Batch 1 (47) + Batch 2 (115) + 23 new today (~185), with resolutions.
2. Fairfax cross-market proven (25 VA peer-review deficiencies, same structure).
3. SOP + Drive tracker so Chris runs exports; confirmed no public objection dataset exists.

### 🔨 In Progress
1. **Corpus growth in batches** — Chris works down the DOB NOW job list; each batch re-ingests and makes Beacon smarter. Never fully "done" — it compounds. *(Beyond GLE, the long play is a data co-op — see NS#4.)*

### ⬜ Not Started
1. **Backtest / first-pass metric** ⭐ — run the plan-reader over past GLE jobs, measure catch-rate vs. the *real* objections the examiner raised → the number: *"we caught X% of the objections before filing."* **Why:** this is the whole pitch — turns "we're faster" from a claim into proof. Verify BEFORE pitching (a savvy architect tests it). Uses tools we already have (plan_reader + objection corpus).
2. **Plan-review engine (Mode B — the "answer key")** — the *review* half of the moat. Load the *full* plan set into a strong multimodal model and RAG-inject GLE's objection/playbook/code knowledge as grounding (don't RAG the doc you're reviewing). Beats chunked-Haiku RAG and raw ChatGPT (which has zero GLE knowledge). Facade/LL11 first. Pro-cert scope = rules, not LLM. *(This is the same item that was duplicated in Area 5 — it lives here.)*
3. **BIS objection harvest** — BIS-era objections have no bulk export → a human opens each job folder. Capture work-type → objection → *how GLE resolved it* (resolution = the moat; no dataset has it). Prioritize common work types; DOB-NOW objections pull free from Socrata, so don't waste the human on those.
4. **Data co-op** — independent filers contribute their objection exports → pooled intelligence beats anyone's own data (network effect; neutrality matters since they're competitors; the roll-up pools contributors automatically — strong PE narrative).

---

## AREA 3 — BD ENGINE

### ✅ Completed
1. Contacts imported (3,358 companies + 4,372); `who_do_we_know` LIVE.
2. DOB Open Data BD tools + `enrich-signal` (one email → N leads).
3. Owner-penetration analysis — GLE owns Rudin ~55%, Macerich ~41%; whitespace whales (Vornado/Tishman/SL Green/Brookfield).
4. Phase 0 filing intel (depth-not-breadth thesis); team-sheet cross-ref; `bd-target-list.csv` built (120 targets); Developer Ranking keystone asset.
5. BD event extraction fixed; newsletter feed + forward-to-teach; referral-tracking UI; `/bd/*` visible.
6. **Signals flow — DONE.** Beacon crawls the newsletter's links → real named opportunities (SL Green/One Vanderbilt verified); Lovable UI = click-into-detail, cached parse (Re-analyze), promote-per-opportunity into a pre-filled lead. Closes: Signals UI, party pre-fill, and the resolve_owner + who_do_we_know cascade.

### 🔨 In Progress
1. **Load `bd-target-list.csv` into the leads pipeline** — the **KEYSTONE.**
   - **What:** a CSV of 120 scored prospects (big private developers/owners): `priority` (A-HOT/B-grow/C-defend/D) · `developer` · `dob_total` (their total DOB volume) · `gle_capture_pct` (GLE's share) · `incumbent_expediter` · self-file/outsource · email · phone.
   - **Do:** insert into Ordino's `leads` table (`source='reverse-bd'`) with a trigger note per row (*"SL Green: 4,495 filings, GLE 0%, outsources to CodeGreen → warm wedge; we run 55% of Rudin"*).
   - **Why keystone:** event-prep and the cascade both need targets *loaded* to work; it's the actual prospect list. **How:** preview-safe SQL (like `bd-cleanup.sql`), you run it. *Not loaded.*
2. **Event-prep enrichment** — for events Natalia/Manny attend, Beacon fills the "who-to-find" (target list × who-we-know) + talking points. Claude's part is ready; **needs #1 loaded** to match who-to-find against the targets.
3. **`bd-email-ingest` wired** — the BD newsletter feed currently falls back to the KB instead of landing in the BD module; needs the Supabase edge-fn deploy so market_news/events route to `/bd/*`. *(File is in your working tree.)*
4. **BD cleanup** (`bd-cleanup.sql`) — purge test/junk leads (Playwright/Plan-Test) + strip `Fwd:/Re:` prefixes on events/signals. Preview-safe (SELECTs first); *not run.*

### ⬜ Not Started
1. **Conversion / attribution tracking** — signal → lead → *won*. The referral UI tracks stages, but nothing proves a target became a client. **Why:** without it you can't tell which signal source actually pays. *(Missing from the old roadmap — worth adding.)*
2. **Entity-resolution map** — Ordino clients/contacts ↔ DOB entity names (Milrose/CodeGreen/GLE each split across 2-3 spellings). **Why:** the keystone for accurate penetration % *and* Client Health; every BD metric leans on it.
3. **Client Health "building-elsewhere"** — compare a client's *total* DOB volume (public) vs. what they file *with GLE*; total steady + ours dropping = building elsewhere (a call worth making, with data). Needs zero QuickBooks. v1 proposal-activity signals exist; the **DOB comparison + two anti-noise rules** (suppress-with-reason, draft-approve-never-auto-send) are the build — the highest-value part.
4. **Hub-architect map** — rank architects as hubs (filing history + DOB OpenData `filing_rep`), flag known / open / competitor-locked. *The architect is the wedge — win the architect, inherit their book.*
5. **Market-data GIFT as the outreach opener** — lead with "here's what your work gets flagged for lately + typical review times" (the BinCheck/pre-filing-check freebie). Decided, not operationalized into the lead flow — it's what turns a cold target warm.
6. **PDL / LinkedIn refresh** — the ~13 A-HOT contacts are 10+ yr stale (verify before calling). Test PDL match-rate on a sample first; enrich only the COLD targets (decision-makers we have no contact for), not people we already have.
7. **Brokers list + referral program** — brokers are the *earliest* deal signal; the gift that makes them work with you = BinCheck/pre-filing check on their listings + reciprocal referrals.
8. **New service: PAA substantial-re-examination** — the Nov-2025 DOB notice created a billable service: when a PAA triggers substantial re-examination, the applicant pays new-app fees via AI1 + PER11 to the Borough Commissioner. **GLE should offer to handle that process.** Exact "recent rule change → new service" pattern.
9. **Rankings / PW3 products** — ENR-style filer/owner rankings from our data (moat = the entity-resolution nobody else maintains) + a PW3 underreporting flag (v1 on public data alone). Sellable, scoped honestly (declared-cost benchmarks, not "true NYC estimating").
10. ⏸️ **Inbound-inquiry copilot** — a 5th classifier category (`inquiry`) that routes a prospect's "do/quote this work" email to a lead + a Beacon-drafted reply. **Shelved** — Manny handles these manually today; inquiries hit his inbox, not beacon@.

---

## AREA 4 — ORDINO PLATFORM  *(~90% done)*

### ✅ Completed
1–5. Content module + design kit + Beacon dashboard; Beacon Q&A logging (don't re-add); cron dial-down; Checklist Gen + Change Orders; multi-tenancy prereq (`beacon_*` + salary RLS); constant-time secrets (17 fns, `ae04e1ba`).
6. ProjectDetail.tsx decomposition — 654 lines (was ~2,500). *[verified]*
7. Dead `ask-ordino` fn removed. *[verified]*
8. Notifications bell (`NotificationDropdown`). *[verified]*
9. delete-admin-only gate (`useIsAdmin`). *[verified]*
10. CO mock data display-gated. *[verified]*
11. Companies list not capping (>1,000 loads). *[verified]*
12. Ingest notifications — PR #43 merged 2026-08-03, deployed. *[verified]*
13. KB grid `uploaded_by`/`modified`/`chunks` display + upload capture (Lovable). *[verified]*

### 🔨 In Progress
1. **`security/rls-edgefn-hardening` branch — deferred merge.** Diverged from `main` (Lovable actively pushing to origin/main; our branch far ahead) → not a clean fast-forward. **Plan:** cherry-pick the 3 security commits (`ae04e1ba` constant-time, `607dadcd` RLS/IDOR, `24224701` RLS fixes) onto current `main` → small reviewable PR; do the actual merge *together* (live repo). Blocks nothing but eventual go-live.

### ⬜ Not Started (long-arc)
1. Notification-triggers audit; Quick-Create polish.
2. QBO Online; Gmail two-way; GA4/GSC connectors — integrations; each is a self-contained build, none blocking.
3. **Legacy → new Ordino migration** — deprecate the old MySQL Ordino; migrate lookup-essentials (projects, companies/contacts, proposals, `p_*` filing tables). Dry-run loader built; verify counts before pulling the plug.
4. **Ordino GO-LIVE** — now gated only on landing the security branch (Companies cap is fine). The platform CS/BinCheck + the flywheel live inside it.
5. Design: flip light-mode `--primary` slate→amber — one-line brand call, touches 30 pages (matches Beacon's DNA which is already loaded but unused).
6. DOB BIS data gap — scrape/proxy for BIS records Open Data lacks (same ingestion problem as BinCheck).

---

## AREA 5 — PRODUCTS & MODULES

### ✅ Shipped
- **Client Portal (`/portal/*`) — LIVE.** Read-only per-client surface (RLS-scoped); staff view sees all orgs + Invite flow. *[verified 2026-08-05]* Residual: test/PIS junk projects to clean.

### ⬜ Not Started (priority-ordered)
1. **🔴 BinCheck → CitiSignal LIVE — THE #1 PRIORITY.** Get ONE product to revenue before anything else. **What:** reliable NYC-agency ingestion (DOB/HPD/ECB/DEP/FDNY) → normalize → key to BIN/BBL → alerts → "Request Assistance" → subscription + event billing. **Blocker:** reliable BIS ingestion + BIN entity resolution (same headless-browser problem as Ordino). **Accelerant: Josh Reiss** — built this exact system for Jack Jaffa (30K+ buildings); engage him to *port the playbook onto Supabase* (1-week diagnostic → 3–5 week pilot), NOT a VB.NET rebuild.
2. **National permit-activity index** — the travelable version of reverse-BD: a real-time, building-level, attributed permit index (a sharper Census BPS). Two uses: a marketing lead-magnet ("sign up for the Filing Monitor") and the wedge freebie ("want this scoped to YOUR building?"). DC-metro PoC built + sent to a peer for feedback. Gate: nail the *value* (PAA turnaround, work-type/borough approval times) before the polish.
3. **SI Coordination module** — Ordino Special-Inspections feature (also a potential SaaS). Born from a real $2k–15k failure (SBMT unwitnessed anchors → TR1 rejection). **Core insight:** don't notify on a date — watch the one *trigger* per SI type (witness-during-install = the dangerous one; trigger = the trade mobilizing, SIA needed 48–72hr before). State machine per SI item = the billable unit. Scope GLE as *coordination*, not liable for SIA performance.
4. **Media / distribution layer** — a data-driven newsletter (to his market) + the Ordino content engine + a few events/yr, as GTM. Anti-Bisnow: monetize the products (hard numbers), not ads. Fixes the built-not-distributed gap. **Two gates:** the content engine must actually work; someone must own audience + events (Manny is the architect, not the operator — events maybe first).
5. Shared "Compliance Plant" / ecosystem consolidation (Josh builds ONE shared pipeline, not inside any product); permit-index product; content-engine port; GLE sale-readiness.

---

## AREA 6 — SECURITY & INFRA

### ✅ Completed
Beacon lockdown · edge-fn IDORs (#44) · `timingSafeEqual` + salary RLS · constant-time across 17 fns · multi-tenancy prereq · generate-project-checklist + monitor-rfps IDOR.

### ⬜ Not Started
1. **`beacon-data-proxy` hardening** — it's a service-key path that bypasses RLS. Verify it DERIVES `company_id` (doesn't trust a passed param) + add a rate-limit. **Gate this before retiring `beacon-qa`** (Area 1 NS#3).
2. **Lovable-migration-drift check on Ordino + CitiSignal** — Lovable never runs hand-authored `.sql` migrations committed via Git, so migrations can silently not-apply. BinCheck was reconciled (closed a live leak); **Ordino + CitiSignal still need the check** (detect + idempotent catch-up).
3. **Beacon batch-2 remaining** — CORS-pin env + per-user AI cost caps. The `/analytics-data` data leak is already gated ✅; only these two hardening extras are left.
4. **SHIELD Act** — a one-page data-handling policy (reasonable safeguards + breach-response plan; doubles as a diligence answer). Plus: encrypt the legacy 2GB dump, keep it local, no personal-cloud sync.
5. **Security backlog** — DWD Gmail clients, a dedicated Beacon service account, dead-code scan, email spoofing/SPF.

---

## NORTH STAR & LOCKED STRATEGY (context, not tasks)
- **Model #1 (best): AI-expert-layer on HARD jurisdictions** — scale NYC's 22yr DOB expertise via Ordino/Beacon/Playbooks. The easy-city land-grab is a mirage (no margin where GCs self-file).
- **BD thesis:** the architect/**owner** is the hub, not the tenant; DOB filings = competitive intel, not leads; Bisnow/press = the pre-filing window; **court owners, not the big CMs** (captive expediters). Growth = **depth** (Derector-type gaps), not breadth.
- **Expansion ring** (when it's time): Charlotte → Greenville → Charleston → Jacksonville (best: "Expediter" role) → Tampa → … **Build the Accela SOP first** (unlocks 8 cities). Backyard: Nassau/Hempstead open-permit-closeout.
- **Discipline:** get ONE product to revenue (BinCheck) before building more; verify the first-pass metric BEFORE pitching; name an operator for anything ongoing; keep Beacon's RAG on Railway (the portable, anti-lock-in brain).

*Detail: `roadmap-parked-threads.md` (archive) · `docs/nyc-reverse-bd-spec.md` · `docs/permit-index-product.md` · memory files.*
