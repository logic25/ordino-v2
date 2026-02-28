

# Add Contact License Type + Specialty Fields

## Overview
Add a two-field system to contacts: **License Type** (RA, PE, Contractor) and a **Specialty** sub-field (Plumber, Electrician, GC, HVAC, etc.) that appears when "Contractor" is selected. This will be surfaced across all contact forms and visible in the contact table so you can identify and filter contacts by trade.

## Database Change
- Add a `specialty` text column to `client_contacts` (nullable).

## UI Changes

### 1. Client Detail Page -- Contact Table + Inline Edit (`ClientDetail.tsx`)
- Add a **License** column to the contacts table header (between Title and Mobile).
- Display the license type (and specialty if Contractor) in the contact row.
- Add **License Type** dropdown and **Specialty** dropdown (conditional on Contractor) to the inline edit panel.
- Include both fields in the `handleSave` update call.

### 2. Add Contact Dialog (`AddContactDialog.tsx`)
- Add `license_type` and `specialty` fields to the form state.
- Add License Type select (RA / PE / Contractor) and conditional Specialty select.
- Include both fields in the insert mutation.

### 3. Edit Contact Dialog (`EditContactDialog.tsx`)
- Already has `license_type` and `license_number`. Replace `license_number` with a `specialty` field when type is Contractor, keep license_number for RA/PE.
- Add the `specialty` field to the update mutation.

### 4. Proposal Reports (`ProposalReports.tsx`)
- In the Change Order analytics "by client type" breakdown, also allow grouping/filtering by contact license type if desired (future enhancement).

## Specialty Options (Contractor subtypes)
Default list: General Contractor, Plumber, Electrician, HVAC, Fire Suppression, Roofer, Mason, Carpenter, Painter, Other.

## Technical Details
- Migration: `ALTER TABLE client_contacts ADD COLUMN specialty text;`
- The Specialty dropdown only appears when License Type = "Contractor".
- RA and PE contacts keep the existing License # field.
- Contractor contacts get a Specialty dropdown instead.
- All three surfaces (table row, inline edit, both dialogs) will be updated consistently.

