# Ordino — Master Roadmap & Reference

*One doc, everything. For Manny to read. Synthesis of accumulated strategy + build state — point-in-time (much of it 3–4 weeks old), so verify specifics against current code before acting. Structure: the North Star → the one priority → expansion mechanics (cities/taxonomy) → the KB/Beacon engine → products & modules → platform state → the discipline.*

*Last updated: 2026-07-09 — see the **CURRENT STATE — 2026-08-03** addendum immediately below for everything that changed since.*

---

## ⚡ CURRENT STATE — 2026-08-03 (read first; §0–§6 below are the Jul-9 strategy base)

*Appended this session. The strategy in §0–§6 still holds — these are the build-state deltas + corrections. Detailed security-vuln specifics are deliberately kept out of this (shareable) doc.*

### Shipped this session (live on Railway / on `main`)
- **Beacon security lockdown (internet-facing).** Beacon's public Railway URL had **unauthenticated** KB ingest, KB read/mutate, `/api/chat`, and an **SSRF** in the email link-harvester. All closed: admin-key required (constant-time `hmac`), SSRF egress guard (blocks internal/link-local IPs, validates every redirect hop). Transparent to Ordino because `beacon-proxy` already forwards the key. Verified live (unauth calls now 403; widget still works).
- **KB engine durability.** Clean-replace on re-ingest (no stale copies left behind), skip low-value ("other") email, real attachment filenames, stuck-email resilience — and the fix for the *actual* bug that was silently dropping the direct DOB "Buildings News Update" emails: a sender-filter **typo** in the Railway env. Env now **augments** the code defaults, so a core DOB sender can never be lost to a typo again.
- **Ingest notifications (new).** A BD signal / content candidate / net-new KB doc now fires an in-app Ordino **bell + realtime toast** to Manny + Chris. Server-side in `beacon-analytics` + `bd-email-ingest`; Beacon calls `notify_ingest` for KB. PR #43 merged to `main` — **needs the Lovable edge-fn deploy to go live** (deploy prompt already provided).

### Completed (continued 2026-08-03)
- **Edge-fn IDOR PR** ✅ merged (`#44`): 2 cross-tenant IDORs (`filing-status`, `draft-proposal-followup`) + `gchat-interaction` fail-closed. **Needs Lovable deploy.**
- **Notifications PR** ✅ merged (`#43`). **Needs Lovable deploy.** (single deploy prompt covers both.)
- **KB quality fixes** ✅ live: citation cache fix (cached answers show sources), `/api/ingest` tmp-name root-cause fix, `update-metadata` paging (large docs no longer split on rename/edit), `Beacon-BD` Gmail label.
- **KB cleanup** ✅: 5 pollution docs removed, 11 DOB guides renamed, zero tmp names left.
- **NYCECC service notice ingested** ✅ → Beacon now answers the 360 Court historic-exemption question (proven live).
- **Mass-pull** ✅: 32 current DOB service notices pulled straight from nyc.gov (service_notices 21 → 53; KB now 153 docs, well-organized by section).

### Completed (2026-08-04)
- **KB manifest hygiene** ✅ live (`210fa07`): all 8 manifest-read sites moved off the broken Pinecone-serverless `list(prefix)` to a metadata-query via a shared `_all_manifests()` helper. **Verified live** — all 158 KB docs now report real chunk counts + `is_current` (were showing defaults); superseded docs flag correctly; deletes/edits no longer leave orphan manifests.
- **`timingSafeEqual` sweep** ✅ (`ae04e1ba` on `security/rls-edgefn-hardening`): 17 edge functions now use a shared constant-time `secureEqual()` (`_shared/secureCompare.ts`) for every secret/key/cron comparison (was short-circuit `===`, a timing side-channel). Fail-closed preserved. **Needs merge + Lovable deploy.**
- **Fairfax jurisdiction added** ✅: KCY peer-review deficiency report (25 items across Building/Mech/Plumb/Elec/Energy, VA codes + resolutions) ingested as `objection_intelligence`, `jurisdiction=Fairfax County VA` — the cross-market answer-key proven with REAL data.
- **NYC Open Data objection check** ✅: confirmed NO public objection dataset exists (DOB datasets hold only job/permit records) → FOIL / manual-export / co-op is the only corpus path.
- **Objection-gathering SOP** ✅: simple assignable checklist (`docs/objection-export-sop.md`) so Chris (or any staffer) runs the per-job DOB NOW export in batches without needing this context.

### In progress / next
- **Deployed via Lovable ✅** — the 5 edge functions (notifications #43 + IDORs #44) are live; `ProjectDetail`/CO mock data removed. Also pulled **32 current service notices + 22 bulletins** from nyc.gov into the KB.
- **Supersession-awareness** (Beacon) ✅ **WORKING — proven end-to-end** (Beacon correctly answers "BB 2020-002 has been superseded — replaced by BB 2026-005"). Engine reads manifests via a metadata-query; marking writes via `/api/ingest`. **Manifest hygiene ✅ shipped + verified live** — see Completed (2026-08-04). **Selective historical backfill still OPEN** (optional: mark older superseded bulletins `is_current=false` so Beacon flags them too — small, low-urgency; only matters for old rules people still ask about).
- **DOB NOW objection-intelligence** ⭐ (NEW, the moat) — **PIPELINE PROVEN ✅**: scoped (371 plan-exam jobs of 1,001; 629 pro-cert skip), work-list built (`plan_exam_jobs.csv`), and a **first batch aggregated — 7 jobs → 47 objections** with examiner/code/AC-ref/reasoning/status, joined to job metadata (`objection_corpus.csv`). Patterns already visible (examiner frequency, objection types, code sections). **No DOB NOW API** → extraction = **manual per-job Excel export** (rename to Job#; Chris hits session-timeout kick-outs, so it's incremental batches). **Loop is LIVE ✅** — Batch 1 (47 objections) ingested as `objection_intelligence`; Beacon now answers *"what gets flagged on this work type"* with examiner/code/reasoning from GLE's own data. **Framed as patterns by work type, NOT an examiner leaderboard** (raw counts reflect job complexity, not strictness). **Remaining:** grow the corpus in batches (DOB NOW session kick-outs make it incremental) — each batch re-ingests + makes Beacon smarter. **Growth beyond GLE = a data co-op:** independent filers contribute their objection exports → pooled intelligence beats anyone's own data (network effect; neutrality matters since they're competitors; the roll-up pools contributors automatically — strong PE narrative). **Cross-market PROVEN with REAL data ✅:** Fairfax County peer-review deficiencies (KCY Engineering — Kiokii/Tysons Corner, 25 items across Building/Mech/Plumb/Elec/Energy with 2021 VCC/VMC/VPC/NEC/VECC refs + how each was resolved) ingested as `objection_intelligence`, `jurisdiction=Fairfax County VA` — same structure as NYC objections, different codes → the answer-key engine is jurisdiction-portable. **NYC Open Data confirmed to hold NO objection field** (only job/permit records: `ic3t-wcy2`, `w9ak-ipjd`, `rbx6-tga4`), so FOIL / manual-export / co-op is the only corpus path. **Note:** Beacon can now *store* Fairfax intel, but the retriever's NYC-only scoping means answering VA questions needs the coverage-aware / jurisdiction-filter wiring (already-built filter, just unwired — see §3).
- **Legacy → new Ordino migration** (NEW) — deprecate old MySQL Ordino. Migrate lookup-essentials (projects, companies/contacts, proposals, project_services, `p_*` filing tables, notes; map users→UUIDs). Leave emails in Gmail; skip system/config junk. **Verify counts before pulling the plug.** Dry-run loader already built.
- **RLS salary scope** — SQL to apply directly (Lovable won't run committed migrations). **STILL OPEN — needs Manny to run the SQL in Supabase.**
- **`timingSafeEqual` sweep** ✅ done — see Completed (2026-08-04). Needs merge + Lovable deploy.

### Corrections to the Jul-9 text
- **§5 multi-tenancy prereq — largely DONE.** Today's RLS audit confirmed the `beacon_*` tables are now **company-scoped** (profile-join, since the June migrations). The real remaining cross-tenant leak is **`employee_compensation` (salaries)** — fix before company #2.
- **§3 email flywheel — now actually flowing.** Direct DOB newsletters ingest again after the sender-filter fix; clean-replace + skip-"other" keep the corpus clean.
- **§3 jurisdiction filter — the concrete build is "coverage-aware answering":** Beacon answers from *real KB coverage* (grounded-only), and says *"no coverage for X yet"* instead of the hardcoded *"NYC-only"* refusal. This is the expansion mechanism. **Fairfax is a natural pilot** (Manny has a live project there). Guardrail: never let it freelance out-of-jurisdiction permit advice from general LLM knowledge.
- **Vocabulary LOCKED — KB vs Markets (Manny's framing):** **KB = jurisdictions we've actually WORKED in** (verified, operational, deep — NYC deep; Fairfax now, via the live project). **Markets = jurisdictions we're RESEARCHING to decide whether to expand** (candidates, not yet worked). A jurisdiction *graduates* Market → KB when we land a real project there. **The inference lever:** NYC is a code *island* (its own construction codes, DOB BIS/NOW, unique objection culture) → its knowledge barely transfers. **Fairfax runs on the I-codes (2021 VCC = 2021 IBC base + VMC/VPC/VECC/NEC/ICC A117.1), which most of the US shares** → Fairfax/IBC objection patterns *infer* to other IBC markets far better than NYC does. **Caveat:** the CODE is ~shared, but local **amendments + the filing PROCESS + who reviews + local relationships are NOT** — inference predicts likely code-objections, not the local process or partners.
- **Market-entry gating questions** (what the Markets research module should capture *before* committing): (1) **code base + amendments** — IBC family? which years? how far from what we know; (2) **filing mechanism** — online/remote vs local-license-required (the online-only North-Star filter); (3) **plan-review model** — self-cert / third-party peer review (FL private-provider, VA EBPR) / in-house AHJ — *third-party-review markets are where our answer-key + a licensed-PE partner = a sellable service*; (4) **local partner / who we know licensed there** — a stamping PE/architect is often required (Pine Tree?, a KCY-type PE); (5) **legal/business setup** — registration, insurance, registered agent, and the **partner agreement** (scope, fee split, liability, communication SLA); (6) **demand / competition / margin** — easy-portal cities = GCs self-file = no margin; friction or third-party-review = margin; (7) **data availability** to build the KB (FOIL / partner history / co-op); (8) **volume + fee economics** vs our remote cost-to-serve.
- **§4 reverse-BD — confirmed SPEC-ONLY.** No DOB-Socrata prospecting engine is wired; market-intel exists only as a dashboard artifact, not a product.
- **§4 compliance answer key → sharpened as the "plan-review engine."** Core insight (from comparing Beacon to raw ChatGPT on a plan set): **don't RAG the document you're reviewing.** Load the *full* plan set into a strong **multimodal** model and use RAG to inject GLE's objection/playbook/code knowledge as grounding. Beats both the current chunked-Haiku RAG *and* raw ChatGPT (which has zero GLE knowledge — the knowledge is the moat).

### The full open board (ranked)
**🔒 Security:** edge-fn IDORs ✅ (merged, needs deploy) · Beacon lockdown ✅ live · `timingSafeEqual` sweep ✅ (needs merge+deploy) · **remaining:** RLS salary SQL (Manny runs it) · Beacon batch-2 (`/analytics-data` auth [leaks `top_questions`] · CORS pin · per-user AI cost caps; **skip `/webhook` — GChat deferred**) · deploy notifications+IDORs+timingSafe via Lovable · `FLASK_SECRET_KEY` set ✓.

**🧠 Moat / revenue engines:** **DOB NOW objection-intelligence dataset → the "answer-key"/plan-review engine** ⭐ — objections (NYC) and peer-review deficiency reports (Fairfax) are the *same thing*, so **one cross-market engine** ("what will get flagged") serves both. **Fairfax = third-party plan review** (GLE + a licensed-PE partner, e.g. KCY; a live project is running it — validates the model). · the live compliance-data product (BinCheck→CitiSignal via Josh) · coverage-aware Beacon + wire jurisdiction filter · reverse-BD engine (DOB Socrata prospecting, spec→build) · market-intel artifact→product · KB supersession finish · beacon-qa retirement.

**🛠️ Ordino features (Lovable track):** QBO Online (after deposits) · kill mock data (`ProjectDetail`, `coMockData`) · Gmail two-way · GA4/GSC connectors · GWI/operational-intelligence instrumentation · Examiner Intelligence + DOB Holdups report (cheap wins) · content pipeline first live run · MCP server publish.

**🧵 Ops loose ends:** GChat @mention fix · Lovable migration-drift check on Ordino + CitiSignal · bug-check scheduled-task auth blocker · `Beacon-BD` Gmail label ✅ done.

**🔐 Compliance / data:** **SHIELD Act** — one-page data-handling policy (reasonable safeguards + breach-response plan; also a diligence answer) · encrypt the legacy 2GB dump, keep local, no personal-cloud sync · **legacy→new Ordino migration** (deprecate old MySQL Ordino — see below) · confirm vendor accounts (Pinecone/Voyage/Anthropic/Railway) under GLE.

**🏗️ Strategic bets:** shared "Compliance Plant" / ecosystem consolidation (Josh Reiss pilot) · permit-index product · content-engine port · SI coordination module · product flywheel (BinCheck→CitiSignal) · media/distribution (newsletter + events) · GLE sale-readiness · design-system uplift.

---

## 0. THE NORTH STAR (and the correction that reshaped it)

**Original vision** ("Green Light Brief, 2025"): a national online-only permit-filing platform — file in 20+ US cities that allow online filing with no local license, delivered remotely by AI + VAs + a lean PM team. "Digital infrastructure for US construction compliance." 10-city model ≈ $2.1M annual profit; pricing below NYC (~$2k/filing).

**⚠️ The major correction (evidence-backed): the easy-city land-grab is a mirage.** Mapping the *real* footprint (offices, case studies, acquisitions — not SEO pages) of every competitor showed they ALL cluster in **hard** jurisdictions (NYC, Chicago, LA, SF, DC) or boom/friction markets (Austin, Dallas, South FL). The easy Sun-Belt cities appear only as SEO shells — zero offices. **Where the portal is easy, local GCs self-file and there's no margin for an expediter.**

**The two demand engines that ARE real (demand = client type, not city):**
- **Model A — national multi-site accounts.** Buyer = retail/restaurant/franchise/auto brands doing rollouts (Target, J.Crew across 35 states, McDonald's). Easy cities are free *coverage*, not markets. This is where "online-only national platform" actually holds — customer is a national brand, not local GCs.
- **Model B — hard-jurisdiction complexity expertise.** Where offices get justified and where Milrose concentrates. **This is GLE's superpower (22yr NYC DOB).** MBE + hard-jurisdiction skill are assets in *hard* markets.

**Three models, ranked:** #1 (best/defensible) = **AI-expert-layer on HARD jurisdictions** — use Ordino/Beacon/Playbooks to scale NYC expertise, template to other hard coastal + friction markets. #2 = private-provider plan review (GreenLite/FL-TX model) — hottest-funded, needs a licensed-architect partner, GLE is a minnow unless it plays the MBE niche. #3 = national multi-site accounts — crowded/funded, needs a specific rainmaker client.

**Funded competitors (don't fight them on their turf):** GreenLite ($86M, FL/TX private plan review — GLE's name doppelganger), PermitFlow ($85M, CA/FL/TX homebuilders), Pulley, Symbium. **Pattern: tech-permitting monetizes REPETITION, not DIFFICULTY — none attack NYC.** NYC/hard = the moat they avoid. That's GLE's lane.

**Founder assets:** Manny worked at **Burnham Nationwide** (knows the national multi-site leader from inside) and knows **Mike Robinson (owner of Permit Place)** — relationship/advisor/complementary-footprint (Permit Place West-heavy, GLE East). Mall-work brand relationships = warm channel to Model A clients. **Financing stance: PE / family office, NOT VC** — raise only to fund growth (Milrose playbook); Ordino's role for PE = the margin/integration engine of a roll-up, not a SaaS product.

**Don't** do the exhaustive 6,900-jurisdiction crawl — that's the easy-city mistake at 100× cost. The jurisdiction DB is built **lazily from real paid work** via Playbooks.

---

## 1. 🔴 THE PRIORITY — get the live compliance-data product live

**BinCheck → CitiSignal, on one shared pipeline.** BinCheck came first (simpler BIN lookup); CS is the more advanced logic (monitoring + alerting + billing). Same underlying capability: **reliable NYC-agency ingestion + BIN entity resolution.**

- **The blocker:** reliable ingestion from portals with no clean API (BIS especially) — the "headless-browser issue" on Ordino is the *same* problem. Plus BIN entity resolution (`compliance_case` keyed on BIN + HMAC webhooks).
- **The accelerant — Josh Reiss.** Already built this exact system for **Jack Jaffa & Associates** (30K+ buildings): hourly polling DOB/HPD/ECB/DEP/FDNY → normalize + dedupe → key to BBL/BIN → role-based alerts → one-click "Request Assistance" → managed-services revenue → subscription + event billing. His stack is old (VB.NET/SQL/SSIS) — **engage him as an advisor who ports the playbook onto the Supabase stack, NOT a VB.NET rebuild.** His model: 1-week diagnostic → 3–5 week focused pilot. Scope the pilot to the ingestion + BIN-resolution CORE (unblocks BinCheck, CS, *and* the Ordino headless-browser problem at once). Cheat sheet: `~/Downloads/Josh-Reiss-CS-Meeting-Cheatsheet.md`.
- **Definition of done:** BinCheck lookup live → CS monitoring converting → first paying users on subscription + event billing. **Get one product to revenue before starting anything else.**

**Also in-flight (needed, not parked): finish Ordino** — the platform CS/BinCheck and the flywheel live inside. Highest-ROI open build = the **DOB NOW Filing Agent** external Python piece (Ordino side + `filing-agent-proxy` already done).

---

## 2. EXPANSION MECHANICS — cities, taxonomy, what each requires

*The engine for Model A/B when it's time. Ordino's **Markets** + **Playbooks** features ARE this brief made real.*

**The 3 entry gates (priority order):** (1) **Online permitting** — file/upload/pay/schedule fully online (table stakes); (2) **No local license required** to file for owners — the dealbreaker gate, comes before volume; (3) **Volume** — Census Building Permit Survey, 3-yr trend, target 3–10 filings/mo within 6–12 months. Markets module fields: `online_permitting`, `license_required`, `permit_platform`, `census_permits_annual/trend`, dept contact.

**Key finding:** "online + no license" barely filters — almost NO US city requires a license to file for an owner (NYC/Chicago/Philly are the exceptions). Real differentiators: contractor-tie strictness (must a licensed GC be *named* before issuance?), competition saturation, a few hard fails.

**Which cities — genuinely underserved + clean (Tier 1 candidates):** Savannah GA, Charleston SC (easiest license in the country — unlicensed agent can HOLD the permit), Greenville SC, Columbus OH, Oklahoma City, Salt Lake City. **Recommended SC beachhead first trio: Charleston + Greenville + Savannah** (wildcard Oklahoma City).

**License difficulty (dial, not binary; GLE has $3M E&O):** Easy (owner-agent files): FL/GA/SC/AZ/UT/OH/IN/MO/NY. Moderate (licensed GC named before issuance): NC/TN/CO/VA/NV/ID/NM. **Philadelphia now VIABLE** via the $3M E&O ($253 + $100K E&O min + background check — a toll, not a wall; big market, 90min from NYC). **Hard fails:** Chicago (needs IL architect for self-cert), Minneapolis (online = licensed contractors only), Augusta GA (physical plans).

**What each city requires — by PLATFORM (this drives SOP reuse):**
- **Accela Civic Platform — 8 cities** (Charlotte, Raleigh, Tampa, Atlanta, Indianapolis, Columbus, Richmond, SLC). **70–80% SOP reuse; Charlotte→Raleigh ~90%. Build the Accela SOP FIRST — highest-leverage engineering in the stack** (unlocks 8 cities at ~20–30% incremental cost each).
- **Avolve ProjectDox** (plan-review layer on top): Austin, SLC. Build once (PDF naming/size, markup-response, resubmittal).
- **CentralSquare eTRAKiT**: Greenville — open self-registration, simplest of all.
- **Custom one-offs (bespoke each):** Nashville ePermits, Jacksonville JaxEPICS, Savannah eTRAC, Charleston CSS, Austin AB+C.

**Agent access verdicts:** GREEN=10 (Charlotte, Charleston, Greenville, Columbia, Jacksonville, Tampa, Raleigh, Indianapolis, Columbus, SLC). **Jacksonville = BEST** — JaxEPICS has a formal "Expediter" checkbox role. **Nashville = RED** (gated to licensed contractors, no public sub-user path — only entry is a GC-partner). **Atlanta = hidden cost** (per-permit notarized affidavit → needs standing Remote Online Notarization infra). **Savannah** needs a GC-signed reg form first (anchor-client outreach is a prerequisite, not parallel).

**Revised launch ring:** D1 Charlotte (Accela, open) · D7 Greenville (eTRAKiT) · D15 Charleston (CSS) · D21 Jacksonville (Expediter role) · D30 Tampa (Accela transfer) · D45 Columbia+Raleigh · D60 Indianapolis+Columbus · D75 SLC · D90 Atlanta (if RON live). **HOLD:** Nashville, Austin, Richmond.

**Backyard plays (fastest revenue, not on the national list):** **Hempstead/Nassau = #1 pilot** — no expeditor license (owner affidavit), and **"Open Permit Closeout" is unproductized white space** (old open permits block home sales; sell to closing attorneys/title cos — GLE already has a referral channel via George Neofitos). **Tampa = parallel private-provider track** (FS 553.791; pair a FL-licensed architect for plan review + expediting on what providers can't touch).

**Pricing model (service fee you keep, excl. municipal fees):** Sign/minor $300–900 · Commercial fit-out/TI $2k–7k (complex to $12.5k) · CO/TCO closeout $1k–2.5k · Residential alteration $500–2,500 · New/major $5k–15k+ · Multi-site rollout $1k–3.5k/location · Blended ~$2k/filing; mature city ~10–12/mo = $20–24k/mo. Industry norm = quote-only, no published rates → **transparency is a differentiator.**

**Expansion market DATA (for ranking):** NJ DCA = gold standard (full Socrata API, typed, per-municipality). Westchester/Nassau = no county-wide API (Census BPS only). Census BPS = the only cross-market backbone (new residential only; download files). ACS B25034 = housing-stock age (alteration-demand proxy). Approximation model: learn new:alteration ratio from data-rich markets (calibrate on **NJ not NYC**) → apply to Census counts; defensible for ranking, not forecasting.

---

## 3. THE KB / PLAYBOOKS / BEACON ENGINE

*This is GLE's real AI IP and the thing that makes expansion scale. Do NOT migrate it into Supabase/Lovable.*

**Beacon = 2 brains + external service:**
1. **BeaconRAG** — external **Railway** app (`github.com/logic25/beacon`): Claude (haiku/sonnet routing) + Voyage embeddings (1024-dim) in Pinecone ("beacon-docs"), plus zoning engine, plan reader, NYC Open Data, content engine, objections, knowledge capture, analytics, Google Chat bot, and `ordino_tools`. **Clean, portable Python — the anti-lock-in asset.**
2. **beacon-qa** — Supabase edge fn (gpt-5-mini, 5 tools, no RAG) — the weaker redundant brain, **slated to retire** (route everything to Railway `/api/chat`, the 13-tool Claude superset).

**DECISION: do NOT migrate the RAG into pgvector/Lovable** — it would downgrade the AI (Claude→openai, Voyage 1024→384-dim), require a lossy port of zoning/plan-reader, and deepen Lovable lock-in. Lovable holds the CRM/UI (replaceable); Railway holds the brain (portable). Keeping it on Railway IS the anti-lock-in choice.

**The 3-layer Playbook / KB architecture (= the per-city expansion model):**
- **Platform SOPs** (Accela, eTRAKiT, ProjectDox, Onlama — reused across cities)
- **Jurisdiction folders** (per city/county — "NYC/DOB" is the flagship, deepest)
- **Project-type playbooks** (TI, CO, sign, new build, change-of-use, demo)
Beacon answers "file a TI in city X" by composing city-X folder + platform SOP + project-type playbook. Metadata dims = platform × jurisdiction × permit_type.

**Multi-market retrieval is ~90% built already** — Railway's retriever already passes a `jurisdiction_filter` to Pinecone, and ingest already stamps a `jurisdiction` field (PR #4 shipped write-side; defaults NYC). **It needs WIRING from Ordino, not migration.** ⚠️ Rollout order matters: Pinecone treats a missing field as non-match, so (1) deploy, (2) backfill-tag existing corpus NYC, (3) ONLY THEN turn on any chat-side jurisdiction filter — else retrieval returns ~zero. Leave chat UNFILTERED until a 2nd city exists.

**NYC = the proof-of-concept:** seed/tune the 22yr NYC knowledge into the by-city KB first — it makes the home market (that GreenLite is coming for) scale now AND validates the KB-by-market model before replicating.

**Email-learning / content pipeline — BUILT + auto-starts, just needs newsletters.** Railway repo has email_poller (polls beacon@ Gmail hourly → parses DOB newsletters → Pinecone), knowledge_capture (Q&A/corrections → KB), and content_engine (drafts blog/newsletter/guide, pending→approved→published). ✅ Activated (DWD authorized, poller authenticating). **Only remaining step: subscribe beacon@ to NYC DOB Buildings News** so emails arrive. This is the flywheel: reads its own inbox → learns → drafts content → fills the KB.

**Beacon two audiences (don't conflate):** (a) internal/staff — full access; (b) client-facing — a client asks about *their own projects only*, gated per-client (RLS by client), limited to a whitelist (status/next-steps/docs), escalates to their PM + a booking flow. The client-facing surface may be partial — verify. **BinCheck has NO Beacon** (its own text/email concierge).

**Beacon analytics reality:** 6yr GChat backfill = 26k msgs → ~1,630 Q's. Top topics: DOB Filings 601 / DOB-System-Status 112 / FDNY 111 / Certs 67 / Violations 66. Validated guides 01–05; must add FDNY/System-Status/Violations/Reinstatement/Fees. Topic taxonomy expanded 13→34 (per-agency, for future filing guides).

---

## 4. 🟡 PRODUCTS & MODULES (parked — good, real, NOT now)

### Client Portal (`/portal/*`) + adding Beacon
Read-only multi-tenant client surface: external client users (`profiles.portal_role='client'`) see ONLY their own org's projects/buildings/filings/docs/action-items, scoped by RLS via `client_org_memberships`; GLE staff see all. **The entire value depends on strict tenant isolation** (RLS on every portal table, no cross-org reads, no client INSERT/UPDATE/DELETE, private `portal-documents` bucket w/ signed URLs, no service_role in the client bundle). **Signup MUST default to `client` (fail safe)** — only @greenlightexpediting.com yields staff. Correctness burns trust: the Ordino-status→7-client-stage mapping must be right (showing "Approved" for an in-review filing = critical failure), `blocked` flag independent of stage, rollup-vs-flat auto-detected. Sync (`portal-filing-sync`) reconciles against Ordino sources, writes `filing_events`, respects manual overrides. Notifications fire on blocked/objection/approved/permit_issued/new-action-item with an idempotency key. Full review checklist lives in CLAUDE.md. **Adding Beacon** = the client-facing concierge above (per-client gated, whitelisted, PM-escalation). *Note: an earlier punch-list entry proposed killing the portal in favor of Beacon Concierge — that's been overtaken; the portal is an active build with its own review checklist. Reconcile the two framings before committing more build.*

### Reverse-BD (NYC market intelligence) — internal
Engine over NYC DOB open data joined to GLE's own records. **The moat = examiner/objection history no public dataset has** (captured in Ordino `dob_applications.examiner_name`). Deduped filer leaderboard, owner/contractor targeting (filter to *addressable*, don't sort by volume), cycle time (pro-cert vs plan-exam bimodal split), the ⭐ **conversion lead feed** (live office→resi conversions with owner + incumbent rep). Datasets: `w9ak-ipjd` (DOB NOW, has filing_rep), `ic3t-wcy2` (BIS 2.7M, no rep), `rbx6-tga4` (permits, has contractor). Report-first, then internal tool. Full spec: `docs/nyc-reverse-bd-spec.md`.

### National permit-activity index — external, scalable
The version of reverse-BD that TRAVELS — real-time, granular, attributed permit index (a sharper Census BPS): real-time vs monthly-lagged, building-level vs MSA, attributed vs anonymous, all-work vs new-residential-only. **DC-metro dashboard (DC + Fairfax, jurisdiction-filterable) is the built proof-of-concept** — sent to a peer expediter as design-partner; his feedback sets the template before replicating. Standalone file: `~/Downloads/DC-Metro-Permits.html`. Full approach: `docs/permit-index-product.md`.

### Compliance "answer key" (pre-submission plan review)
Classifier (work-type flags × description) → check-modules/playbooks grounded in the objection dataset + Beacon → review engine (enforced coverage, deterministic + grounded LLM; pro-cert = rules) → first-pass-rate eval. Facade/LL11 first. The honest claim = pre-submission audit + a first-pass metric — do NOT claim autonomous automation (a peer catches a bluff). Lovable builds the answer key; Claude builds market-intel. Detail: memory `compliance-engine-architecture`.

### SI Coordination module
Ordino Special-Inspections feature (also a potential standalone SaaS). Born from a real failure (SBMT unwitnessed post-installed anchors → TR1 rejection, $2k–15k). **Core insight: don't notify on a date — watch the one TRIGGER signal per SI type.** Witness-during-install (anchors/welding) = the dangerous one (trigger = trade mobilizing, need SIA scheduled 48–72hr before). State machine per SI item = the billable unit. Lives as an "Inspections" tab on the Job object. T1 = manual lead-time math + notifications (prevents SBMT alone); T2 = AI reads email thread for mobilization language; T3 = auto-classify from TR1. Pricing: ~$100–175/SI item + ~$300 floor. Liability: scope GLE as *coordination*, not responsible for SIA performance. Defensive too — Crosscheck's SIA cross-sells KM on GLE's own threads.

### Media / distribution layer
Data-driven newsletter to Manny's market + the Ordino content engine + a-few-events-a-year, as GTM for GLE/Ordino/index. **Anti-Bisnow: monetize the products (hard numbers, not vibes), not ads.** Fixes the built-not-distributed gap. Two gates: content engine must really work; someone must own audience + events (Manny isn't the operator). Events maybe first (instant list, few-times-a-year, plays to his relationship strength, feeds the newsletter). Detail: memory `media-distribution-layer`.

---

## 5. ORDINO PLATFORM STATE (build hygiene)

**✅ Shipped (don't redo):** Content module + pipeline; design kit (`PageHeader`/`StatCard`); Beacon dashboard in Help Desk→AI Usage (Feedback panel, RLS admin-read fix un-hiding 138 rows, confidence-scaling fix, enrichment); **Beacon Q&A logging is DONE — reject any task to re-add it (would double-count)**; cron dial-down; Automated Checklist Gen + Change Orders (were mislabeled "gap," actually built); ask-ordino→Beacon rewire.

**⬜ Open (near-term):** Notifications bell + Quick-Create; delete dead `ask-ordino` fn (after usage tab flattens); **mock CO data cleanup** (`coMockData.ts` — `coImported` must stay false); notification-triggers audit.

**🔭 Long arcs:** retire beacon-qa → Railway `/api/chat`; **ProjectDetail.tsx decomposition** (~2500 lines, fragile); jurisdiction tagging in Pinecone then wire the filter; DOB BIS data gap (needs scrape/proxy — this is the *same* ingestion problem as §1); Beacon concierge (validate demand first).

**Design system:** Ordino ALREADY has Beacon's DNA (amber `--accent`, JetBrains Mono loaded) — pages just render generic shadcn instead of using it. Kit built; roll page-by-page. **One global lever (needs OK): flip light-mode `--primary` slate→amber** = every button matches Beacon in one line (touches all 30 pages, so it's a deliberate brand call).

**⚠️ Security / infra debt (open):**
- **beacon-data-proxy** — confirm it safely DERIVES/verifies company_id (doesn't trust a passed param) + rate-limit; it's a service-key path that bypasses RLS. Gate before retiring beacon-qa.
- **Lovable-migration-drift check** — Lovable never runs hand-authored `.sql` migrations committed via Git; BinCheck was reconciled (closed a live leak); **Ordino + CitiSignal STILL need the check.**
- **Multi-tenancy prereq (expansion blocker, not a today-bug):** `beacon_*` tables have NO `company_id` + company-unscoped RLS. Inert while single-tenant; a cross-company leak the day Ordino serves company #2. Fix THEN (add company_id + backfill + scope RLS). ⚠️ Do NOT let Lovable change `has_app_role`'s signature — it cascades.
- Security backlog: DWD Gmail clients, dedicated Beacon SA, dead-code scan, email spoofing/SPF, flip proxy strict flag.

---

## 6. THE DISCIPLINE

The risk isn't that these are bad — they're good. The risk is **building beautiful things and never charging anyone** (the built-not-distributed trap). Sequencing:
1. **Get ONE product live and converting** — BinCheck→CS via Josh. Everything else waits.
2. **Grow/defend NYC** — it's HOME, not a target market; it's the engine AND the top of the rollout funnel. Seed NYC into the by-city KB (proof-of-concept + moat defense vs GreenLite).
3. **Let demand pull the next thing** — a landed Model-A client or a real friction niche, not a geographic land-grab.
4. **Name the operator for anything ongoing** (distribution, events) — you're the architect/allocator, not the operator.

**Deeper docs:** `docs/nyc-reverse-bd-spec.md` · `docs/permit-index-product.md` · CLAUDE.md (client-portal review checklist) · memory files (compliance-engine-architecture, media-distribution-layer, beacon-architecture, expansion-strategy, city-expansion-ranking, platform-agent-access, si-coordination-module, dob-market-intelligence, greenlite-competitive-decode).
