

## PIS Refinements and GC Compliance Checking

### Summary of Changes

Based on your feedback, here's what needs to happen:

1. **Keep Filing Type on PIS** -- it stays where it is (reverting previous plan to remove it)
2. **Remove Client Reference Number from PIS** -- move it to the internal project record only
3. **Exclude Insurance and Special Notes section from readiness scoring** -- the section stays visible but won't count as "missing"
4. **Format phone numbers properly** -- apply `(XXX) XXX-XXXX` formatting to all phone fields in the PIS
5. **Corporate Officer fields conditional** -- only show when Ownership Type is Corporation, Condo/Co-op, or Non-profit
6. **Make Area (sq ft) and HIC License optional** -- don't count them toward readiness
7. **GC Compliance cross-reference** -- when a GC is entered (by staff or client), check the clients table for their `dob_tracking_expiration`, `hic_license`, and insurance status; flag if expired or missing

---

### Technical Details

**A. EditPISDialog.tsx (Internal PIS editor)**
- Add `optional?: boolean` to `PisFieldDef` interface
- Mark `sq_ft`, `apt_numbers`, `gc_hic_lic` as `optional: true`
- Mark all `notes` section fields as `optional: true`
- Remove `client_reference_number` from the `applicant` section fields
- Keep `filing_type` in place
- Conditionally render `corp_officer_name` and `corp_officer_title` only when `ownership_type` is "Corporation", "Condo/Co-op", or "Non-profit"
- Apply `formatPhoneNumber` from `src/lib/formatters.ts` to all phone-type fields in `renderField`
- Update `getSectionProgress` and `allFields` count to exclude optional fields from totals
- Add a GC compliance banner: after the GC section, if `gc_company` or `gc_name` matches a client record, show their DOB tracking expiration and insurance status with a warning badge if expired

**B. useProjectDetail.ts (Readiness calculation)**
- Export an `OPTIONAL_PIS_FIELD_IDS` set from EditPISDialog
- In `useProjectPISStatus`, exclude optional field IDs from `totalFields` and `missingFields` counts
- Exclude the entire `notes` section fields from the readiness calculation

**C. RfiForm.tsx (Public client-facing PIS)**
- Remove `client_reference_number` field from the public form sections
- Keep `filing_type` visible for clients
- Apply `formatPhoneNumber` to phone fields (already partially implemented)

**D. GC Compliance Check (EditPISDialog.tsx)**
- When GC name/company is entered, query the `clients` table to find a matching record (by name or DOB tracking number)
- If a match is found, display an inline status card showing:
  - DOB Tracking # and expiration date (green if current, red if expired)
  - HIC License status (if they have one)
  - Insurance status from their client record
- If expired or missing, show a warning with option to "Send Reminder" (pre-fills an email draft)
- This uses existing data from the `clients` table (`dob_tracking`, `dob_tracking_expiration`, `hic_license`, insurance fields) -- no new tables needed

**E. ProjectDetail or ProjectDialog**
- Add `client_reference_number` as an editable field on the project record (internal only) so it's still tracked but not on the PIS sent to clients

