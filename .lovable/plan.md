# Objections: grounded drafts, a real code library, and the drawings

## The problem, confirmed

The draft that said *"Rear yard compliance has been verified and confirmed on the drawings... is dimensioned on the site plan"* is fabricated. The draft request sends only the objection text, the code reference, the filing type, your notes, and prior decisions. **No drawing, no sheet, and no code text is passed** — the model has never seen a drawing and cannot verify anything. It produced confident language because the prompt asks it for "a direct, professional response."

Three fixes, in the order they matter.

---

## 1. The draft can no longer claim things it cannot know

Any statement of verified fact that isn't backed by something in the workspace becomes a placeholder you must fill in.

- The instruction changes to: state the compliance position and the reasoning, but **never assert that anything was verified, dimensioned, shown, or confirmed on a drawing** unless a drawing is attached and cited.
- **A deterministic backstop does the real enforcement — the model is not trusted to police itself.** After every draft returns, the text is scanned in code for assertion verbs and compliance claims (`verified`, `confirmed`, `dimensioned`, `provided`, `shown`, `indicated`, `complies` / `compliant` / `in compliance`, `meets the requirement`, and sheet-name patterns like `sheet Z-1`). When **no sheet is pinned to the objection**, every match is rewritten into an inline `[VERIFY: ...]` marker carrying the original phrase. When a sheet *is* pinned, claims naming a sheet other than a pinned one are still flagged.
- The same scan runs on text you type or paste into the draft box, not just on AI output — so a claim can't slip through by being edited in.
- Markers are highlighted in the draft box, and **Save, Send as Email, and Mark Resolved are blocked while any `[VERIFY: ...]` marker remains**, with a message naming what's outstanding. You either fill it in or delete the claim.
- A short "grounded in" line under the draft lists exactly what the response was built from: cited code section, attached sheets, your notes, prior decisions. If that list is empty, it says so.

Result: the draft becomes an argument you finish, not a finished-looking claim you have to catch. The prompt change reduces how often claims appear; the scanner guarantees none get through unflagged.


---

## 2. Click the code pill → a real code section, from our own library

You were right to hesitate on where the code text comes from. Beacon's knowledge base holds Green Light guides and notices — not the full text of the Building Code, Zoning Resolution, or Administrative Code. Pointing the pill at Beacon would produce paraphrases dressed up as code text, which is the same problem as the fabricated draft.

**We build our own code library instead — grown from the sections we actually work, not scraped wholesale.**

A new `code_sections` library keyed by section number (`ZR 33-42`, `AC 28-104.7`, `BC 1003.6`) holding: the section text, a plain-English summary of what it requires, related/exception sections, a link to the official source, and a verification state (`unverified` / `verified by <person> on <date>`).

Clicking the pill opens a side panel:

- **Section already in the library** — shows the text, the summary, related sections, the official link, and who verified it.
- **Not in the library yet** — honest empty state with the official source link and an "Add this section" form. You paste or type the text once; it's verified and reused by everyone from then on. Optionally, AI drafts the plain-English summary *from the text you pasted* — never the text itself, which is always human-entered or linked.

Nothing is ever presented as code text unless a person put it there. The library fills in as the team works, and by the tenth ZR 33-42 objection the section is already there.

---

## 3. Argue applicability, and have the argument become the draft

Under the code panel, a rebuttal thread scoped to that objection:

- You write the real position — *"doesn't apply, the lot is a corner lot under ZR 23-711"* — or ask it to help you determine whether it applies.
- Reply is grounded in the section text in the library, the related sections, your notes, and prior decisions on that section. If the cited section isn't in the library, it says so rather than inventing it.
- Any section you name in the thread becomes a pill you can click and add to the library.
- **Use in draft** pulls the thread's conclusion into the draft response as the reasoning, so the argument you actually made is the argument that gets sent.

---

## 4. The drawings

- **Plan sheets from the project** — the panel lists the project's Plans documents (13 are already attached to projects) so you can open a sheet next to the objection instead of hunting for it.
- **Pin a sheet to the objection** — pin the specific document and type the sheet number (`Z-1`, `A-101`). Pinned sheets are the only thing a draft is allowed to cite by name.
- Cite a sheet with no pin and it becomes a `[VERIFY: ...]` marker from item 1.

Note on scope: this puts the drawing **in front of you** and lets you cite it deliberately. It does not read the drawing — no system here can confirm a rear yard dimension from a PDF, and pretending otherwise would recreate the exact problem you flagged.

---

## Technical notes

- **New table `code_sections`** — company-scoped: `code_reference` (unique per company), `title`, `full_text`, `plain_summary`, `related_sections[]`, `official_url`, `jurisdiction`, `verified_by`, `verified_at`, `source` (`manual` / `imported`). Standard company RLS + grants.
- **New table `objection_sheet_refs`** — links an objection to a `universal_documents` row plus a `sheet_number` and optional note.
- **New table `objection_rebuttals`** — objection-scoped thread: `role` (`pm` / `ai`), `content`, `cited_sections[]`.
- **New `src/lib/verifyClaims.ts`** — the deterministic scanner: a phrase/verb pattern list plus a sheet-reference pattern, returning `{ text, markers[] }`. Pure and unit-testable, so the claim list can be tuned without touching the UI. Runs on AI output and on the draft textarea's own content.
- **`handleDraftResponse` in `ResearchWorkspace.tsx`** — prompt rewritten with an explicit anti-fabrication clause and a `[VERIFY: ...]` protocol; context extended with the code section text, pinned sheets, and the rebuttal thread. Output passes through `verifyClaims` before hitting state; unresolved markers gate Save / Send / Mark Resolved.
- **New `CodeSectionPanel.tsx`** — pill click target: library view, add-section form, rebuttal thread, sheet pinning.
- **`ObjectionCard` and the objection header** — code pill becomes a button; a small dot marks sections not yet in the library.
- **Decision capture** — records already written on resolve gain the cited section and pinned sheet references, so the Decision Log shows what the call was actually based on.
- No changes to the Beacon knowledge base or ingestion. AI is used only for summarising text you supplied and for the rebuttal thread — never to originate code text.

## Build order

1. **Anti-fabrication prompt + deterministic `[VERIFY: ...]` scanner + gating.** This is the bleeding wound — it stops fabricated claims from shipping today, and it needs nothing else to work. Until sheet pinning exists, the scanner has no pinned sheets to check against, so every such claim is flagged; that is the correct behaviour, not a limitation.
2. Sheet listing and pinning — gives the scanner its "is this claim backed?" input and puts the drawing in front of you.
3. `code_sections` table + code pill panel + add/verify flow.
4. Rebuttal thread + "Use in draft".

