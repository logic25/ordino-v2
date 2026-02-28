

## Fix Missing Items: Group by Section Heading + TPP "Same as Applicant" Logic

### What Changes

Update the readiness calculation in `useProjectDetail.ts` to show smarter, grouped missing items instead of individual field labels:

1. **GC unknown** -- Instead of listing individual GC fields, show a single **"General Contractor (TBD)"** entry in missingFields
2. **TPP "Same as Applicant"** -- Treat this as resolved (not missing at all). No entry in missingFields.
3. **TPP unknown (No / blank)** -- Show a single **"TPP Applicant (TBD)"** entry
4. **SIA unknown** -- Show a single **"Special Inspector (TBD)"** entry
5. **GC/TPP/SIA "Yes" but details incomplete** -- Continue showing individual missing field labels as before

### Technical Detail

**File: `src/hooks/useProjectDetail.ts` -- `useProjectPISStatus`**

After the existing conditional exclusion logic (lines 257-277), instead of simply excluding fields from `allFields`, build the `missingFields` array with grouped labels:

- When `gcKnown !== "Yes"`: exclude all GC detail fields from `allFields` (already done), then append `"General Contractor (TBD)"` to the final missingFields array
- When `tppKnown` includes "Same as Applicant": exclude TPP fields (already done), add **nothing** to missingFields -- it's resolved
- When `tppKnown` is blank or "No": exclude TPP fields (already done), append `"TPP Applicant (TBD)"` to missingFields
- When `siaKnown !== "Yes"`: exclude SIA fields (already done), append `"Special Inspector (TBD)"` to missingFields

The grouped TBD labels are appended after the per-field missing calculation so they appear alongside any other genuinely missing fields (like owner name, address, etc.) but replace the noisy individual contractor fields.

