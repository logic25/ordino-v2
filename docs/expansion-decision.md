# Expansion Decision Memo — NYC Deep vs. New Markets

> For Manny + Chris. Successor to the March 2025 expansion thread. Status: decision
> framework agreed; capital gates below. The tracking surface is **BD → Markets** in
> Ordino (PR #11) — research checklist, readiness gates, per-market salesperson +
> revenue goal/actual.

## The thesis (updated from the March plan)
The March plan was a *revenue* expansion plan (5-city cold launch). The actual goal
right now is *system validation*: prove Ordino + Beacon can run a non-NYC jurisdiction
with inexpensive labor ("anyone who can read plans"), then scale market-by-market with
a dedicated salesperson per major market.

**The Milrose pattern is the sales model:** hire a NYC-caliber PM/seller, ship them to
a market where the brand doesn't matter, give them a $100K revenue goal — they did
$300K. Per-market unit: ~$130K loaded salesperson cost targeting $300K year-1 revenue.

## Budget — the two paths

### Path 1 — NYC deeper (base case, highest confidence)
| Item | Year-1 (loaded) |
|---|---|
| Full-time NYC BD/sales hire | $130–160K |
| 2 LatAm production staff (plans-literate, client comms, Beacon-backed) | $40–70K |
| Ordino revenue-engine features (outbound, pricing intel) | ~$0 cash (Lovable + internal) |
| **Total** | **~$200–250K** |

Expected: BD rep selling with 22 years of brand/relationships → $400–600K+; LatAm
hires expand delivery without a 4th PM. Payback inside the year.

### Path 2 — Expansion, staged (not all-at-once)
| Stage | Cost | Proves |
|---|---|---|
| Adjacent validation (Long Island / Jersey City) | ~$15–25K/quarter | Tech + cheap-labor model works outside NYC; demand = existing-client spillover, no salesperson needed |
| First major market (Tampa or Philadelphia) | ~$175–200K/yr ($130K salesperson + $30K LatAm + $20K KB/SOP/travel/marketing + $10K entity/E&O) | The $300K/city model. Breakeven yr 1, profit yr 2 |
| 3-city simultaneous (the March plan) | $500–600K/yr | Don't — sequencing risk |

### Recommendation
Run **Path 1 + adjacent validation in parallel (~$250K total)**. Commit the first
~$175K major-market bet only when BOTH green lights are on:

1. **Eval gate:** research-eval harness ≥ 90% pass on a non-NYC jurisdiction
   (visible on the Markets page per city).
2. **Sales proof:** the NYC BD hire is producing (proves we can manage commissioned
   salespeople before shipping one to a city we can't see).

## Services: same skeleton, different bones
Service **categories** port to every market: permit filing & coordination, plan-review
management, trade permits (MEP), inspection scheduling, CO/TCO closeout,
violations/compliance. Service **items** do not: PW1/TR1/TR8, Alt filings, LL11/FISP,
LPC, DOB NOW workflows are NYC-only. Tampa = building permit + trade permits + fire
marshal + private provider; Philly = EZ permits + L&I.

**Product implication — jurisdiction-scoped service catalogs (next build):**
- `service_templates` keyed by `jurisdiction_id`: name, description, default price,
  category, active.
- Proposals/projects pick services from the market's catalog at the market's price
  (March plan priced expansion ~40% below NYC — encode per-market price books).
- NYC's current service list becomes the NYC jurisdiction's catalog (no behavior
  change for existing flows).

## The RA/PE play (why Florida first matters)
Florida's **Private Provider program (FS 553.791)** allows firms with licensed
PE/RA staff to perform plan review and inspections *in place of the building
department*. With an RA/PE on staff in FL, GLE isn't navigating the queue — it IS the
queue. Higher margin, licensure moat, and the strongest version of "Ordino as a
permitting platform." Texas has third-party review variants. This weighs Tampa /
Jacksonville heavily for market #1. (Verify current program details per county at
entry — rules evolve.)

## Org plan
- **Expansion point person: Manny or Chris, personally, year one.** Founder-led —
  the playbook doesn't exist yet; the first market is where it gets written. (The
  Milrose hire succeeded *with Milrose's playbook behind him*.)
- **NYC BD: hire full-time now.** The playbook exists here; a hire can execute it.
  Fastest payback in the plan.
- **Keep the 3 PMs as the senior layer** (escalation, QA, client trust).
- **LatAm production under the PMs, in NYC first**: plans-literate, strong
  communicators; Beacon + KB + filing-prep tooling supplies the "what goes where on
  the form." Validate the labor model at home where PMs catch errors, THEN export it
  to market #2. The research hardening (citation verification + eval harness) is the
  proof mechanism.

## Sequence (one line)
NYC BD hire + 2 LatAm in NYC + adjacent validation now (~$250K) → market #1 with a
$100K-goal salesperson when eval gate + NYC BD are both green (~$175K) →
raise / partner / keep compounding off the proof.

## Open items
- Pick the adjacent validation jurisdiction (Islip / Babylon / Hempstead / Jersey City)
  based on where existing clients already have spillover work.
- Curate the first non-NYC eval question set (30–50 Q→A with citations) once the
  jurisdiction is chosen.
- Service-catalog build (above) after the Markets module merges.
- Florida private-provider legal/insurance diligence before committing market #1.
