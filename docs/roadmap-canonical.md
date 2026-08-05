# Ordino / Beacon / GLE — CANONICAL ROADMAP (truth doc)

*Rebuilt 2026-08-05 from `roadmap-parked-threads.md`, line by line, into **Completed / In Progress / Not Started**, by area. This is the working truth doc. Strategy/North-Star context lives at the bottom; the archive roadmap stays for detail.*

Legend: ✅ done & live · 🔨 in progress (partially built / actively moving) · ⬜ not started

---

## AREA 1 — BEACON (KB, RAG, answering quality)

### ✅ Completed
1. Security lockdown — auth-gated ingest/read/chat, SSRF egress guard, constant-time HMAC.
2. **Boot-crash fix** (`UnboundLocalError` from a shadowed `import os`) — `97c018c`, today.
3. KB duplicates / phantom manifests fully resolved — delete-fix `a27ea1f` + prune `be1c23a` (266→134 real docs, won't recur).
4. FDNY "Business" phantom cleared — today (backend was clean; browser-cache ghost).
5. "Guesses instead of retrieving" / TR2 root cause — RAG-skip fixed, form-code forces RAG + rerank boost (`affcadf` + `c8e6d7f`).
6. **Over-deferral / reason-first prompt** (`d519580`) — **VERIFIED LIVE today** (ACP-5 answered + labeled, no reflexive punt).
7. **Numeric-grounding / fee-faithfulness rule** (`bec47b3`) — **VERIFIED LIVE today** (fee answer now quotes the right rows).
8. No-fabricated-code-section rule; objection-as-pattern guardrail.
9. Manifest hygiene (`210fa07`); supersession engine + backfill.
10. KB pulls — 32 service notices + 22 bulletins from nyc.gov, with citations.
11. Email flywheel flowing (sender-filter typo fixed); clean-replace on re-ingest.
12. Newsletter link-crawl + BD feed (`bd89e96`); forward-to-teach (`e64eee7`).
13. DOB Open Data tools — `dob_capture` / `dob_team_sheet` / `resolve_owner` (`341cf1c`).
14. `who_do_we_know` tool (`d4d512d`); `extract_deal_leads` / `enrich-signal` (`01b54d4`).
15. Clean BD event extraction (`0b0ae80`); KB-noise fix — tool answers show no phantom sources (`571fad8`).
16. **Objection `.zip`/`.xlsx` upload path** — parser rewritten to read sheet XML directly (DOB NOW breaks openpyxl); today.
17. **Fee table (Admin Code 28-112.2) ingested**; **Chris's ~18 net-new guides ingested + tagged "Chris Henry"**; today.
18. KB dedup-incident recovery (Fairfax, Spring Valley, objection batches restored); folder corrections (RCNY→rules).
19. **Fee thread closed** — numeric-grounding rule (`bec47b3`, verified live); the authentic Feb-2026 fee Service Notice re-ingested with the **real nyc.gov source** (it had been mislabeled "notice 2026-001", which is actually an elevator-barrier *Bulletin*); Admin Code Table 28-112.2 in KB. $591.75 = the 7-floors-and-above example at $20k, not a flat fee.
20. **KB attribution fixed** (`cac009e`) — `rebuild-manifest`/re-ingest now **preserve** `uploaded_by` + dates (they were wiping them on every rebuild). Backfilled: Chris's net-new batch = "Chris Henry", original filing guides = "Manny Russell". Ordino grid display = the Lovable plan (Area 4 In-Progress #2).
21. **Signals link-crawl** (`9b03c55`) — `extract_deal_leads` now crawls the newsletter's article links (SSRF-guarded) before extraction. Verified live: thin blurb → SL Green / One Vanderbilt pulled from the linked article.

### 🔨 In Progress
1. **Objection corpus growth** — now ~185 (162 + 23 today); ongoing batch-by-batch.
2. **Chris's 6 held guides** — decision list delivered; awaiting Chris. Supersede cases = **edit-in-place** in Ordino (re-embeds), not re-ingest.
3. **Clickable sources – Phase 1** — hyperlink the `source_url` already in official docs, in Chat + widget. *Not built.*
4. **Jurisdiction filter / coverage-aware answering** — retriever ~90% built (passes filter); needs: backfill-tag corpus NYC → then turn filter on. Fairfax is the pilot.
5. **Beacon model routing** — route hard Qs Haiku→Sonnet (adoption lever). Decided, not done.
6. **Thumbs up/down feedback** — revive + wire downvotes into KB-gaps. Decided, not done.

### ⬜ Not Started
1. **Reference-miner** — the **BB/SN completeness audit** (read-only Beacon job).
   - **What it does, 3 legs:** (1) **Extract** — read each filing guide in the KB, pull every `Buildings Bulletin 20XX-XXX` / Service Notice / `RCNY §` / TPPN it cites. (2) **Validate** — check each cited bulletin against the KB's *"Buildings Bulletin Master Index with Supersession Tracking"* → is it **current or superseded** (and by what). (3) **Gap-detect** — for each guide's topic/work-type, find bulletins that **govern that topic but the guide doesn't cite** (using the form-code tags + semantic match).
   - **Output per guide:** ✅ cited & current · ⚠️ cited but **superseded** (→ its replacement) · ➕ relevant & current but **MISSING**.
   - **Why it matters:** it surfaces which guides are **stale** (citing dead BBs) *and* which BBs are actually worth pulling into the KB — only the handful the guides *should* reference, instead of mass-ingesting hundreds. The two TR2 bulletins (BB 2009-026 / 2014-017) were the pilot hit — cited in Chris's Structural guide, absent from the KB.
   - **Cost:** read-only, touches nothing; produces a shortlist you approve before any ingest.
2. beacon-qa retirement → route all to Railway `/api/chat`.
3. Clickable sources – Phase 2 (storage bucket for GLE's internal docs).
4. DOB Service-Notice **freshness loop** (auto-ingest new notices → keep fees current).
5. EBC (Existing Building Code) ingest, tagged "not yet in force" (effective 2027-07-17) + current-vs-EBC diff.
6. KB correction — "what's a PAA" (drop the false Minor/Major + structural/egress restriction; the real constraint is the substantial-re-exam fee).
7. Trim the every-~25s Pinecone `describe_index_stats` calls — **cause: `/health` runs `get_stats()` on every uptime ping** (verified, bot_v2.py ~1622). Fix: make `/health` a cheap liveness check; move the doc-count to `/api/status` or cache it.
8. ⏸️ Drive objection poller — **blocked** on a Workspace-admin step (add Drive scope to the service account's domain-wide delegation). Deferred; upload path covers it.

---

## AREA 2 — THE MOAT (objection intelligence)

### ✅ Completed
1. Objection loop live — Batch 1 (47) + Batch 2 (115) with resolutions.
2. **+23 new DOB NOW exports ingested today** via the new upload path (~185 total).
3. Fairfax cross-market proven — 25 VA peer-review deficiencies, same structure.
4. SOP + Drive tracking sheet so Chris runs exports himself.
5. Open Data confirmed to hold **no** objection dataset (manual export / FOIL / co-op is the only path).

### 🔨 In Progress
1. Corpus growth in batches (DOB NOW session kick-outs make it incremental).

### ⬜ Not Started
1. **Backtest / first-pass metric** ⭐ — run the plan-reader over past GLE jobs vs the *real* objections → the number that unlocks the whole pitch.
2. **Plan-review engine (Mode B)** — the "answer key" review half; load full plan set into a multimodal model, RAG-inject GLE objection/playbook knowledge.
3. BIS objection harvest (manual, hire — BIS has no bulk export).
4. Data co-op (independent filers pool objections → network effect).

---

## AREA 3 — BD ENGINE

### ✅ Completed
1. Contacts imported — 3,358 companies + 4,372 real contacts; **who-do-we-know LIVE**.
2. DOB Open Data BD tools (capture / team-sheet / resolve-owner) + `enrich-signal` (one email → N leads, proven live).
3. Owner-penetration analysis — **GLE owns Rudin ~55%**, Macerich ~41%, Muss ~23%; whitespace whales (Vornado/Tishman/SL Green/Brookfield/Boston Props).
4. Phase 0 filing intel — GLE 2,916 filings; **depth-not-breadth thesis** (Derector 1.4% → +28% ceiling); team-sheet cross-ref.
5. **Phase 1 target list built — `bd-target-list.csv` (120 developers)**: priority · DOB volume · GLE capture · incumbent · contact. 13 A-HOT.
6. Developer Ranking file identified as the keystone contact asset (8,402 pipeline rows + ~300 contacts).
7. BD event extraction fixed (`0b0ae80`); BD newsletter feed + forward-to-teach; Signals in BD nav; referral-tracking UI; `/bd/*` bin visible.
8. **Signals flow — DONE (2026-08-05).** Beacon `enrich-signal` **crawls the newsletter's article links** → real named opportunities (verified: blurb → SL Green / One Vanderbilt). Lovable shipped the UI: click-into-detail sheet, cached parse (Re-analyze), and **promote-per-opportunity into a pre-filled lead** — blind bulk-create removed. This closes the old in-progress items: Signals UI wiring, create-lead party pre-fill, and the `resolve_owner` + `who_do_we_know` cascade (enrich-signal runs those per opportunity).

### 🔨 In Progress
1. **Load `bd-target-list.csv` into the leads pipeline** — the **KEYSTONE.**
   - **What it is:** a CSV of **120 scored prospects** (big private developers/owners). Each row = `priority` (A-HOT / B-grow / C-defend / D) · `developer` · `dob_total` (their *total* DOB filing volume) · `gle_capture_pct` (GLE's current share of it) · `incumbent_expediter` (who does their work now) · self-file/outsource · `email` · `phone`. Built from Phase-0 (Developer Ranking × live DOB capture).
   - **What "load" means:** insert those 120 rows into Ordino's **`leads`** table (`source='reverse-bd'`), each with a **trigger note** — e.g. *"SL Green: 4,495 filings, GLE 0%, outsources to CodeGreen → warm wedge; we run ~55% of Rudin."* Then the team can see + work them as prospects in `/bd/leads`.
   - **Why it's the keystone:** event-prep and the reactive cascade both need the targets *loaded* to match "who-to-find." It's the actual prospect list the whole BD engine acts on — until it's in, everything downstream is empty scaffolding.
   - **How:** a preview-safe SQL script (like `bd-cleanup.sql`) — you run it in Supabase. *Not loaded yet.*
2. Event-prep enrichment — who-to-find + talking points (needs #1 loaded).
3. `bd-email-ingest` wired — BD feed currently falls back to KB; needs the Supabase deploy.
4. BD cleanup (`bd-cleanup.sql`) — purge test/junk leads + strip Fwd:/Re:. Preview-safe, not run.

### ⬜ Not Started
1. **Signal detail view** (can't click into a signal today).
2. **Conversion / attribution tracking** — signal → lead → *won* (missing from roadmap; without it you can't tell which source pays).
3. **Market-data GIFT as the outreach opener** — decided, not operationalized into the lead flow.
4. **Entity-resolution map** (Ordino clients ↔ DOB entity names) — keystone for penetration + client-health.
5. Hub-architect map (rank architects known/open/competitor-locked).
6. Client Health "building-elsewhere" DOB comparison + anti-noise (v1 proposal signals exist; DOB half + suppress-with-reason + draft-approve NOT built — the highest-value part, needs no QB).
7. PDL / LinkedIn refresh of the ~13 A-HOT cold contacts (stale 10+ yr).
8. Brokers list + referral program (motion).
9. **New service: PAA substantial-re-examination** (PER11/AI1 + Borough-Commissioner) — productizable.
10. Rankings product + PW3 underreporting flag (sellable, scoped honestly).
11. ⏸️ Inbound-inquiry copilot (5th classifier category) — shelved (Manny handles manually).

---

## AREA 4 — ORDINO PLATFORM  *(verified against code 2026-08-05 — ~90% done)*

### ✅ Completed
1. Content module + pipeline; design kit (`PageHeader`/`StatCard`); Beacon dashboard in Help Desk→AI Usage.
2. **Beacon Q&A logging is DONE** — reject any task to re-add it (double-counts).
3. Cron dial-down; Automated Checklist Gen + Change Orders; ask-ordino→Beacon rewire.
4. Multi-tenancy prereq — `beacon_*` company-scoped + salary RLS.
5. Constant-time secret comparison across 17 edge functions (`ae04e1ba`).
6. **ProjectDetail.tsx decomposition — DONE** (654 lines, was ~2,500). *[verified]*
7. **Dead `ask-ordino` fn removed** — gone from functions/ + src. *[verified]*
8. **Notifications bell** — `NotificationDropdown` live in TopBar. *[verified]*
9. **delete-admin-only gate** — `isAdmin`/`useIsAdmin()` gates doc edit/delete. *[verified]*
10. **CO mock data** — display gated (`coImported` defaults false); no fake data shows. *[verified]*
11. **Companies list NOT capping in practice** — `useClients` has no `.range`, but >1,000 loads (max-rows raised / under cap). Not a go-live blocker. *[verified]*
12. **Ingest notifications** — in-app bell + toast when Beacon ingests KB / BD / content. PR #43 merged 2026-08-03 (`a9b00203`), deployed. *[verified]*
13. **KB grid `uploaded_by` / `modified` / `chunks` display + upload capture** — shipped by Lovable (grid reads Beacon per-doc metadata, local records take precedence; new uploads stamp the uploader). Pairs with the Beacon attribution preserve+backfill (Area 1 #20).

### 🔨 In Progress
1. **`security/rls-edgefn-hardening` branch — deferred merge.** Diverged from `main` (Lovable actively pushing to origin/main; our branch far ahead) → not a clean fast-forward. Plan: cherry-pick the 3 security commits (`ae04e1ba` constant-time, `607dadcd` RLS/IDOR, `24224701` RLS fixes) onto current `main` → small reviewable PR. **Deferred — blocks nothing but eventual go-live.**

### ⬜ Not Started (3–7 — long-arc, per Manny)
1. Notification-triggers audit; Quick-Create polish.
2. QBO Online; Gmail two-way; GA4/GSC connectors.
3. Legacy → new Ordino migration (dry-run loader built).
4. **Ordino GO-LIVE** — now gated only on landing the security branch (Companies cap is fine).
5. Design: flip light-mode `--primary` slate→amber.
6. DOB BIS data gap (scrape/proxy).

---

## AREA 5 — PRODUCTS & MODULES (parked bets — real, not now)

### ✅ Shipped
- **Client Portal (`/portal/*`) — LIVE.** Staff view sees all client orgs (org selector, project cards, blocked/permits/actions counters, Cards/Tracker toggle, Invite Client flow); scoped per-client via RLS. Built on `main`. *[verified via screenshot 2026-08-05]* — Note: some test/PIS junk projects showing under MJS Architect (data cleanup, not a build gap).

### ⬜ Not Started (priority-ordered)
1. **🔴 BinCheck → CitiSignal LIVE — THE #1 priority** (get ONE product to revenue before anything else). Blocker = reliable BIS ingestion + BIN entity resolution. Accelerant = **Josh Reiss** pilot (advisor-ports-the-playbook, not a VB.NET rebuild).
2. National permit-activity index (DC-metro PoC built, sent to a peer for feedback).
3. SI Coordination module (watch the per-SI-type trigger; born from SBMT anchor failure).
4. Media / distribution layer (data newsletter + a few events/yr; needs an operator named).
5. Shared "Compliance Plant" / ecosystem consolidation (Josh); permit-index product; content-engine port; GLE sale-readiness.

> *Removed "Compliance answer-key / plan-review engine" from here — it's the same item as **Area 2 NS#2** (the Mode-B review half). Tracked in Area 2, where the objection corpus feeds it.*

---

## AREA 6 — SECURITY & INFRA

### ✅ Completed
Beacon lockdown · edge-fn IDORs (#44) · `timingSafeEqual` + salary RLS · constant-time across 17 fns · multi-tenancy prereq · generate-project-checklist + monitor-rfps IDOR (this branch).

### ⬜ Not Started
1. beacon-data-proxy — verify it DERIVES `company_id` (doesn't trust a param) + rate-limit (gate before retiring beacon-qa).
2. **Lovable-migration-drift check on Ordino + CitiSignal** (BinCheck reconciled; these two still need it).
3. Beacon batch-2 remaining — **CORS-pin env + per-user AI cost caps** (the `/analytics-data` data leak is already gated ✅; only these two hardening extras are left).
4. SHIELD Act one-page data policy; encrypt the legacy 2GB dump (local, no cloud sync).
5. Security backlog: DWD Gmail clients, dedicated Beacon SA, dead-code scan, email spoofing/SPF.

---

## NORTH STAR & LOCKED STRATEGY (context, not tasks)
- **Model #1 (best): AI-expert-layer on HARD jurisdictions** — scale NYC's 22yr DOB expertise via Ordino/Beacon/Playbooks; the easy-city land-grab is a mirage (no margin where GCs self-file).
- **BD thesis:** the architect/**owner** is the hub, not the tenant; DOB filings = competitive intel, not leads; Bisnow/press = the pre-filing window; **court owners, not the big CMs** (captive expediters). Growth = **depth** (Derector-type gaps), not breadth.
- **Expansion launch ring** (when it's time): Charlotte → Greenville → Charleston → Jacksonville (best: "Expediter" role) → Tampa → … **Build the Accela SOP first** (unlocks 8 cities). Backyard: Nassau/Hempstead open-permit-closeout.
- **Discipline:** get ONE product to revenue (BinCheck) before building more; verify the first-pass metric BEFORE pitching; name an operator for anything ongoing.
- **Don't migrate Beacon's RAG off Railway** (Claude + Voyage + Pinecone = the portable, anti-lock-in brain).

*Deeper detail: `roadmap-parked-threads.md` (archive) · `docs/nyc-reverse-bd-spec.md` · `docs/permit-index-product.md` · memory files.*
