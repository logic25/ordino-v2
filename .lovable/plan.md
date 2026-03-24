
Goal: fix the remaining CitiSignal formatting issues in the CO report/applications UI so it matches CitiSignal’s own display logic for descriptions, statuses, doc numbers, colors, and applicant names.

What I found
- The bad values are already in local synced data for this property, so the issue is now mostly UI normalization, not missing sync:
  - descriptions still contain `&nbsp;`
  - statuses are still raw CitiSignal/BIS strings like `X`, `X SIGNED OFF`, `P APPROVED`, `Withdrawn`
  - some rows have no explicit `doc_number`, so the UI must derive doc # from `job_number` suffix
  - applicant names are often missing on BIS_SCRAPE child docs and need inheritance/fallback logic
- In `PropertyDetail.tsx`, CitiSignal rows are mapped too literally:
  - `status: a.status || a.filing_status || ""`
  - `desc: a.description || ""`
  - `docNum: a.doc_number || a.document_number || ""`
  - `tenant: a.applicant_name || a.owner_name || a.applicant || null`
- `COApplicationsView.tsx` then renders those raw values directly, so:
  - status badges miss `STATUS_COLORS` matches
  - descriptions show `&nbsp;`
  - doc # is blank when only the job suffix exists
  - applicant info is wrong or empty for BIS child docs
- The reference CitiSignal project already has stronger normalization patterns in `PropertyApplicationsTab.tsx`, including:
  - doc-number derivation
  - applicant fallback logic
  - status normalization from BIS codes/labels
  - handling stale/missing applicant values

Implementation plan
1. Add a shared normalization layer for CitiSignal/BIS application rows
- Create small helpers in the CO flow (likely in `PropertyDetail.tsx` or a nearby utility) to:
  - strip `&nbsp;` / non-breaking spaces from descriptions
  - normalize status codes/phrases to UI labels like:
    - `X`, `X SIGNED OFF` → `Signed Off`
    - `P`, `P APPROVED` → `Approved`
    - `R`, `PERMIT ISSUED` → `Permit Issued`
    - `Q` → `Permit Issued`
    - withdrawn variants → `Withdrawn`
    - unknown leftovers → `In Process`
  - derive `docNum` from `job_number` suffix when missing
  - infer source label consistently for BIS / BIS_SCRAPE / DOB BIS / DOB NOW rows

2. Fix applicant display to match CitiSignal-style logic
- Port the useful parts of the CitiSignal project’s applicant fallback behavior:
  - for grouped BIS child docs, try doc-specific applicant first
  - if missing, use parent/doc-01 applicant where appropriate
  - avoid obviously bad applicant values
- Ensure mapped CO rows always populate `tenant` from the best available applicant source before rendering.

3. Update the CitiSignal mapping inside `PropertyDetail.tsx`
- Replace the current raw field pass-through with normalized mapped values for both:
  - auto-sync CitiSignal import path
  - manual “Import/Refresh” CitiSignal path
- Make sure the mapping writes CO-friendly fields consistently:
  - cleaned `desc`
  - normalized `status`
  - derived `docNum`
  - corrected `tenant`
  - better `jobType` / `workType` fallback
- Keep raw upstream fields on the object for debugging, but make normalized fields win.

4. Tighten COApplicationsView rendering
- Use the normalized fields as the source of truth.
- For grouped related filings:
  - always show `Doc #01`, `Doc #02`, etc. when derivable
  - keep parent row + related docs visually aligned with CitiSignal
- Improve source/status badge logic so colors always match normalized labels instead of raw upstream text.

5. Clean up violations/status presentation where needed
- Apply the same display cleanup for any CO report sections that still show raw source/BIS labels or uncleaned strings.
- Confirm HPD/DOB violation presentation uses readable normalized text and consistent badge colors.

6. Verify against the actual property data you flagged
- Specifically validate the 320514261 group after the normalization changes:
  - no `&nbsp;`
  - parent + docs remain nested
  - doc numbers visible
  - applicant values make sense
  - status pills read correctly and match intended colors
- Also verify the generated CO report uses the same normalized application/violation data instead of raw upstream values.

Technical details
- Files likely involved:
  - `src/pages/PropertyDetail.tsx`
  - `src/components/properties/co/COApplicationsView.tsx`
  - possibly `src/components/properties/co/COViolationsView.tsx`
  - possibly `src/components/properties/co/COReportPDF.tsx`
- Reference implementation to borrow logic from:
  - `@project:9d9b6494-36da-4c50-a4c2-79428913d706` → `src/components/properties/detail/PropertyApplicationsTab.tsx`
- No database changes are needed for this fix.
- Main root cause: CitiSignal sync is populating local rows, but the CO UI is still rendering raw upstream values instead of using the same normalization rules as the CitiSignal app.
