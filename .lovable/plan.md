
# Reimagined Settings: From 13 Sections to 8 Focused Modules

## The Problem Today

The current settings page has **13 cards** that feel like a filing cabinet -- some drawers are empty, some duplicate each other, and small utility lists get the same visual weight as complex configuration systems. It's hard to find what you need quickly.

### What's Wrong Specifically

| Current Section | Lines of Code | Problem |
|---|---|---|
| Profile | 100 | Missing phone extension, hourly rate, signature from legacy |
| Company | 125 | Good, but duplicated inside Invoice Settings |
| Team & Users | 230 | Too basic -- slide-out sheet instead of full detail view |
| Proposals & Services | 209 | Solid -- keep as-is |
| Company Types | 105 | Tiny tag list -- doesn't deserve its own card |
| Review Categories | 102 | Tiny tag list -- doesn't deserve its own card |
| Lead Sources | 155 | Small list -- same category as above |
| RFI Templates | 517 | Solid -- keep as-is |
| Invoices & Billing | **891** | Bloated: has Company Info (duplicate), Payment Methods, Terms, Email Templates, Collections, Demand Letters, ACH Templates, Logo, Billing Rules, QBO -- all in one |
| Automation Rules | 474 | Solid -- keep as-is |
| Notifications | 0 | Empty placeholder |
| Subscription & Plan | 0 | Empty placeholder |
| Security | 0 | Empty placeholder |

---

## The Reimagined Structure: 8 Modules

### 1. Profile (enhanced)
Your personal info -- what exists now, plus:
- **Phone extension** field (legacy had this -- e.g., "x12")
- **Hourly rate** (needed for billing calculations and the team detail view)
- **Signature** (draw or upload -- used on proposals and internal approvals)

### 2. Company (single source of truth)
Organization details: name, email, phone, fax, address, website. One place for this data. The duplicate inside Invoice Settings gets removed -- Invoice PDFs will pull from here automatically.

Also adds:
- **Company logo upload** (moved from Invoice Settings -- logo is a company asset, not an invoice setting)
- **Tax ID / EIN** field (useful for formal documents)

### 3. Team & Users (full detail view)
Replace the basic table + slide-out with:
- Same table list with search, active/inactive counts
- Clicking a member opens an **in-page detail view** (not a sheet) with:
  - Profile card: avatar, name, role, phone + extension, hourly rate, member since, signature preview
  - **Proposals tab**: all proposals where they're the salesperson
  - **Projects tab**: all projects where they're assigned PM or senior PM
  - Back button to return to the list
- Show inactive users (greyed out) so admins can see the full roster

### 4. Proposals & Services (unchanged)
Service catalog and default terms/conditions. Works well today.

### 5. Lists & Lookups (merged)
Combines three small list managers into one tabbed section:
- **Company Types** tab (Architect, GC, Plumber, etc.)
- **Review Categories** tab (Responsiveness, Fair Price, etc.)
- **Lead Sources** tab (Referral, Website, etc.)

Each tab keeps its existing UI -- just wrapped in a single card with tabs instead of three separate settings cards.

### 6. RFI Templates (unchanged)
Questionnaire configuration. Works well today.

### 7. Invoices & Billing (streamlined)
Remove the Company Info section (now in Company settings). Keep:
- Invoice header/footer text (PDF-specific branding)
- Payment Methods (check, wire, Zelle, CC)
- Default Payment Terms
- Invoice Email Template (subject + body with merge fields)
- Collections Timeline (reminder days, auto-reminders, early payment discount)
- Demand Letter Template
- ACH Authorization Template
- Client Billing Rules
- QBO Integration

### 8. Automation Rules (unchanged)
Collection workflows and auto-reminders. Works well today.

### Removed (for now)
- **Notifications** -- empty placeholder, no value
- **Subscription & Plan** -- empty placeholder, no value
- **Security** -- empty placeholder, no value

These come back when they have actual functionality behind them.

---

## Route Cleanup

Add a redirect so the old `/team` URL doesn't 404:
```text
/team --> redirects to /settings
```

---

## Database Changes

Add three columns to the `profiles` table:

| Column | Type | Purpose |
|---|---|---|
| phone_extension | varchar | Office extension (e.g., "12") |
| hourly_rate | numeric | Billing rate for time tracking |
| signature_data | text | Base64 signature image or SVG data |

---

## Files to Modify

- **Database**: Migration to add 3 columns to `profiles`
- **`src/pages/Settings.tsx`**: Restructure from 13 sections to 8, remove placeholders, add Lists & Lookups
- **`src/components/settings/ProfileSettings.tsx`**: Add phone extension, hourly rate, signature upload/draw
- **`src/components/settings/TeamSettings.tsx`**: Replace sheet with in-page detail view, add Proposals/Projects tabs, show inactive users
- **`src/components/settings/InvoiceSettings.tsx`**: Remove Company Info section (lines 381-444), move logo to Company settings
- **`src/components/settings/CompanySettings.tsx`**: Add logo upload, Tax ID field
- **`src/hooks/useProfiles.ts`**: Add `useAllCompanyProfiles()` that includes inactive users
- **`src/App.tsx`**: Add `/team` redirect route

## New Files

- **`src/components/settings/ListsAndLookupsSettings.tsx`**: Wrapper component with tabs for Company Types, Review Categories, and Lead Sources

## Unchanged Files

- `CompanyTypeSettings.tsx` -- reused inside Lists & Lookups
- `ReviewCategorySettings.tsx` -- reused inside Lists & Lookups
- `LeadSourceSettings.tsx` -- reused inside Lists & Lookups
- `RfiTemplateSettings.tsx` -- no changes
- `AutomationRulesSettings.tsx` -- no changes
- `CollapsibleSettingsCard.tsx` -- no changes
