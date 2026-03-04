

## Contact Autocomplete on Client-Facing PIS Form

**What you asked for:** When a client (e.g., a homeowner) fills out the PIS after signing a proposal, they should be able to start typing a name like "Matt Miller" or "StudioLab" in contact sections (GC, SIA, TPP, Owner, Applicant) and get suggestions from your company's contacts database, with auto-fill of the remaining fields.

**Key challenge:** The PIS form is a public page accessed via token — no authentication. The `client_contacts` table is behind RLS. We need a secure way to expose contact search to unauthenticated users who have a valid PIS token.

---

### Plan

**1. Create an edge function `pis-contact-search`**
- Accepts `token` (PIS access token) and `query` (search string, min 2 chars)
- Validates the token against `rfi_requests` to get the `company_id`
- Searches `client_contacts` and `clients` filtered to that company
- Returns name, email, phone, company_name, address, license info — limited to 10 results
- No sensitive data exposed; scoped to the company that owns the PIS

**2. Add a `usePISContactSuggestions` hook**
- Called from `RfiForm.tsx` with the token and a search query
- Debounces input (300ms) and calls the edge function
- Returns typed suggestions matching the `usePISAutoFill` field mapping structure

**3. Add inline autocomplete to contact sections in `RfiForm.tsx`**
- For sections with `contactRole` (Applicant, Owner, GC, SIA, TPP): add a search input at the top of each section
- When user types 2+ characters, show a dropdown of matching contacts
- On selection, auto-fill all fields in that section (name, company, phone, email, address, license info)
- Reuse the same field-mapping logic from `usePISAutoFill`'s `SECTION_FIELD_MAP`, adapted for the client-facing field key format (`sectionId_fieldId`)
- Visual: small search bar with a "Search contacts..." placeholder, dropdown below with name + company

**4. No database changes needed** — the edge function uses the service role key to bypass RLS, scoped to the company via the validated token.

---

### Technical Details

- Edge function path: `supabase/functions/pis-contact-search/index.ts`
- Query logic: `WHERE company_id = <company_id> AND (name ILIKE '%query%' OR email ILIKE '%query%' OR company_name ILIKE '%query%')`
- Field mapping for client-facing keys uses the format `{sectionId}_{fieldId}` (e.g., `contractors_inspections_gc_name`)
- The autocomplete component will be a lightweight inline dropdown (no external dependencies), similar to the existing `SectionAutoFill` in `EditPISDialog`

