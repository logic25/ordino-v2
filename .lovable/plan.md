

## Bug Fix: Properties showing hardcoded Queens Center Mall mock data

### Problem
Every property detail page shows 20 fake DOB applications from Queens Center Mall (Auntie Anne's, Parfois, Adidas, etc.) because:
1. `coImported` initializes to `true` (should be `false`)
2. `coApps` initializes with `MOCK_CO_APPLICATIONS` (should be `[]`)
3. `coViolations` initializes with `MOCK_CO_VIOLATIONS` (should be `[]`)
4. The import handler just loads mock data via `setTimeout`

### Plan

**1. Create `src/hooks/useDOBApplications.ts`**
- Export an async function `fetchDOBApplications(bin: string)` that calls two NYC Open Data endpoints:
  - DOB Job Filings: `https://data.cityofnewyork.us/resource/ic3t-wcy2.json?bin__=${bin}`
  - DOB NOW Build: `https://data.cityofnewyork.us/resource/rbx6-tga4.json?bin=${bin}`
- Map API responses to the existing `COApplication` interface (status mapping, work type inference from boolean fields like `sprinkler`, `fire_alarm`, `plumbing`, `mechanical`, `equipment`)
- Merge both result sets, sort by file date descending, re-number sequentially
- Return typed `COApplication[]`

**2. Update `src/pages/PropertyDetail.tsx`**
- Change initial state: `coImported → false`, `coApps → []`, `coViolations → []`, `lastSynced → null`
- Replace `handleImportDOBData`: check for `property.bin`, show error toast if missing, otherwise call `fetchDOBApplications(property.bin)`, set results into state
- Remove `MOCK_CO_APPLICATIONS` and `MOCK_CO_VIOLATIONS` imports (keep type imports and other mock data references if needed elsewhere)
- Set `coViolations` to `[]` on import (real violations fetch is a future TODO)

**3. Update bug report status**
- Mark the feature request as `ready_for_review` with resolution notes

