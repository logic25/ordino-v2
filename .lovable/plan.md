

## Comparison: Existing PDF Proposal vs Current System Output

### What the Existing PDF Does Well (Keep/Adopt)
1. **Page header on every page** — "Proposal #020526-3 / RE: 1720 Eastchester Rd" appears top-left on every page as a running header. Our system doesn't have this for print.
2. **"ACCOUNT DETAILS" box** — Shows both the client company (with full address) AND a separate "Billed to" block. Our current "Prepared For" card only shows the bill_to contact; it doesn't show the full client address or distinguish account vs billing.
3. **"Billed to" with full address** — The old PDF shows the billing contact's street address. Our system only shows name/email/phone.
4. **Scope items use bullet points** (not `›` arrows) — cleaner, more traditional.
5. **Optional Services as a simple table** — "DOT permits — $250 each" format. Clean and compact vs our current card-style layout.
6. **Terms broken into labeled sub-sections** — Payment Terms, Suppliers, Mutual Indemnification, Limitation of Liability, Additional Services, Miscellaneous. Our system renders terms as a single block of text.
7. **Signature block with Title field** — The old PDF has "By / Title / Date" lines. Our current version is missing the **Title** field.
8. **Footer on every page** — Address + contact info + page number. Our footer only appears once at the bottom.

### What Our Current System Does Better (Keep)
1. **Clean Apple-esque white design** with the brand color accent line — much more modern than the old PDF.
2. **Side-by-side info cards** (Prepared For / Project Details) — better visual hierarchy than the old stacked text.
3. **Architect/Engineer and GC info blocks** — the old PDF doesn't show these at all.
4. **Work Types badges** — disciplines shown as clean tags. Not in the old PDF format.
5. **Retainer/deposit callout** — highlighted prominently. Old PDF buries it in payment terms text.
6. **Digital signature rendering** — actual signature images displayed inline.

### Recommended Changes

#### 1. Add "Billed To" address to Prepared For card
Pull the client's full mailing address (from the `bill_to` contact or the client record) so it matches the old PDF's complete billing info.

#### 2. Add "Title" field to signature block
Both the company side and client side should show "By / Title / Date" — matching the old PDF. The signer's title should be pulled from their profile or contact record.

#### 3. Break Terms & Conditions into labeled sub-sections
Instead of one big text block, parse or store terms as structured sections (Payment Terms, Suppliers, Indemnification, Liability, Additional Services, Miscellaneous) and render each with its own bold heading — matching the old PDF's format.

#### 4. Add page-level header/footer for print
When printing/PDF, inject a running header ("Proposal #XXX / RE: Address") and footer (company address + page numbers) using `@page` CSS rules.

#### 5. Fix the accent color
The `amber` variable is still set to `hsl(65 69% 54%)` — this is the wrong green. Should be updated to the correct GLE green from the brand (the lime-chartreuse from the logo, visible in the uploaded PDF header).

#### 6. Optional services as compact table
Render optional items in a simpler two-column table format ("Service — $X each") rather than full cards, matching the old PDF's cleaner approach.

### Files to Modify
- `src/components/proposals/ProposalPreviewModal.tsx` — all visual changes above
- `src/pages/ClientProposal.tsx` — mirror changes for public-facing version
- `src/pages/ClientChangeOrder.tsx` — mirror where applicable
- `src/components/proposals/SendProposalDialog.tsx` — email template consistency

### What NOT to Change
- Keep the modern white header + logo layout (don't revert to the old PDF's plain text header)
- Keep the side-by-side card layout for Prepared For / Project Details
- Keep the Architect/GC info blocks (old PDF didn't have these — they're an improvement)
- Keep the digital signature image rendering

