
Goal: make page 2 print safely and self-contained so it does not start at the very top edge and clearly identifies what document/project it belongs to when pages are separated.

What I found:
- The PDF version (`src/components/projects/ChangeOrderPDF.tsx`) currently renders everything in a single `<Page>` and has no page numbering or continuation header, so when content overflows onto a second page there is no repeated identifier at the top.
- The client/HTML printable version (`src/pages/ClientChangeOrder.tsx`) uses `@page { margin: 0.4in; size: letter; }`, but there is no repeated header on later printed pages either.
- There is already a proven react-pdf pattern for page numbering in `src/components/projects/LitigationPDF.tsx` using `render={({ pageNumber, totalPages }) => ...}`.

Implementation plan

1. Add a fixed per-page header band to the CO PDF
- Update `src/components/projects/ChangeOrderPDF.tsx`
- Add a small fixed header that appears on every page, above body content, with:
  - `Change Order {co.co_number}`
  - project identifier: project number first, else project address/client
  - optional title line if space allows
  - `Page X of Y`
- Increase the page’s top padding so page 2+ has a proper top margin and never starts near the edge.

2. Keep the existing visual first-page header, but reserve space for overflow pages
- Preserve the branded first-page company/logo header exactly as-is.
- Add top spacing logic so normal content still starts correctly on page 1 while overflow pages inherit the repeated fixed header.
- This avoids changing the approved first-page design while fixing page-break behavior.

3. Make the signature/terms section paginate more intelligently
- Review `wrap={false}` usage on the signature section in `src/components/projects/ChangeOrderPDF.tsx`.
- Keep the signature block together, but ensure the lead-in legal/intro text doesn’t get orphaned awkwardly at the top or bottom of a page.
- If needed, group the terms reference + signature intro together so page breaks occur in cleaner places.

4. Add a compact continuation context, not just page numbers
- The repeated header should explicitly reference the document so a printed second page is meaningful on its own:
  - CO number
  - project number/address
  - page number
- This directly addresses your “if someone printed it there would be nothing” concern.

5. Align the browser print view with the same behavior
- Update `src/pages/ClientChangeOrder.tsx` print layout so printed HTML also has stronger page context:
  - slightly increase print top margin from the current `0.4in` if needed
  - add a print-only repeated document identifier near the top of the printable content
- The goal is consistent output whether someone prints from the client signing page or downloads the PDF.

Files to update
- `src/components/projects/ChangeOrderPDF.tsx`
- `src/pages/ClientChangeOrder.tsx`

Technical notes
- Best pattern for the PDF is a `fixed` header/footer plus `Text render={({ pageNumber, totalPages }) => ... }`.
- The current CO PDF only has a fixed footer; I’ll mirror the same technique at the top.
- The cleanest fix is structural, not cosmetic: reserve top space globally on the PDF page instead of just adding margin to one section.
- I would not rely only on footer page numbers; the missing context problem is specifically at the top of separated printed pages.
