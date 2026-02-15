

## Plan: Contextual Partner Emails + Due Date Sorting

### 1. Contextual/Tailored Partner Notification Emails

**Problem**: When an RFP is not a direct match (e.g., LL11 filings, facade inspections), the partner email should position your firm as a support partner rather than a prime bidder. Currently all emails use the same generic "Partnership Opportunity" template.

**Solution**: Detect the RFP type from service tags and title keywords, then tailor the email subject, intro paragraph, and CTA accordingly.

**Changes to `src/components/rfps/buildPartnerEmailTemplate.ts`**:
- Add a helper function `detectRfpContext(rfp)` that categorizes the RFP by scanning `service_tags` and `title` for keywords like "LL11", "facade", "FISP", "inspection", "environmental", etc.
- Based on the detected context, vary:
  - **Subject line**: e.g., "LL11/FISP Support Opportunity: [Title]" instead of generic "Partnership Opportunity"
  - **Intro paragraph**: e.g., "We'd like to offer our firm's inspection/filing support for this upcoming LL11/FISP requirement" instead of "We'd like to invite your firm to collaborate"
  - **Services section**: Highlight only the relevant services (e.g., facade inspection, DOB filings) rather than the full catalog
- Context categories to support initially:
  - **LL11/FISP** (facade inspection/filing support)
  - **Environmental** (asbestos, lead, Phase I/II)
  - **General construction/engineering** (default collaborative tone)
  - **Default** (current behavior for unrecognized types)

### 2. Sort Discovery List by Due Date

**Problem**: The discovered RFPs list has no sorting; users cannot order by urgency.

**Changes to `src/pages/RfpDiscovery.tsx`**:
- Add a sort toggle button (similar to the RFP table view) near the search/filter area
- Default sort: due date ascending (soonest first), with null dates at the bottom
- Add a `useMemo` wrapper around the `rfps` array to apply sorting before rendering
- Simple toggle between "Due Date (soonest)" and "Relevance Score (highest)" using a state variable and a small dropdown or toggle button

### Technical Details

**File changes:**

| File | Change |
|------|--------|
| `src/components/rfps/buildPartnerEmailTemplate.ts` | Add `detectRfpContext()` helper; update `buildPartnerEmailSubject()` and `buildPartnerEmailBody()` to use contextual messaging |
| `src/pages/RfpDiscovery.tsx` | Add sort state + `useMemo` for sorted list; add sort toggle UI (dropdown with Due Date / Relevance options) |

**Context detection logic (pseudocode):**
```text
function detectRfpContext(rfp):
  tags + title keywords -> lowercase scan
  if matches "ll11", "fisp", "facade" -> return "ll11_support"
  if matches "environmental", "asbestos", "lead", "phase" -> return "environmental"  
  if matches "construction", "renovation", "build" -> return "construction"
  else -> return "general"
```

**Email variations by context:**
- `ll11_support`: Subject includes "LL11/FISP Support", intro positions firm as inspection/filing support partner, highlights relevant certifications
- `environmental`: Subject includes "Environmental Services Support", focuses on testing/abatement capabilities
- `construction`: Standard collaborative partnership tone
- `general`: Current default behavior (no change)

