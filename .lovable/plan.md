

## Plan: Email Template Gallery — Visual Status Badges + Extended Style Controls

### What's changing

**1. "Live" vs "Coming Soon" badges on each template chip**

Each template button in the gallery will show a small visual indicator:
- **Green dot** — template is wired to a real send path (10 templates)
- **"Coming Soon" badge** — template is preview-only, not yet sending (4 templates: Project Closeout, Payment Received, Project Status Update, Referral / Thank You)

This makes it immediately obvious which templates are actively used and which are design-only.

**2. Extended Style Controls in the editor**

The Style tab currently supports: accent color, font family, and button corners. We'll add:

- **Body Text Color** — color picker + hex input for the main paragraph text (currently hardcoded to `#334155`)
- **Heading Text Color** — color picker + hex input for headings/greeting (currently hardcoded to `#1e293b`)
- **Body Font Size** — slider or preset options (13px / 14px / 15px / 16px) for the main body text size

These new tokens will be saved alongside the existing `email_style` settings and flow through `resolveEmailStyle()` to every send path, keeping the single-source-of-truth guarantee.

### Technical details

**File: `src/components/settings/EmailTemplateGallery.tsx`**
- Add a `LIVE_TEMPLATE_IDS` set containing the 10 wired template IDs
- Update the template selector buttons to show a green dot or "Coming Soon" label based on membership
- Add 3 new controls to the Style tab: body text color picker, heading text color picker, and font size selector
- Wire new style fields into `StyleConfig` and the preview builder

**File: `src/components/proposals/buildProposalEmailHtml.ts`**
- Extend `ProposalEmailStyleConfig` with `bodyColor`, `headingColor`, `bodyFontSize`
- Update `resolveEmailStyle()` to include the new fields with sensible defaults (`#334155`, `#1e293b`, `15px`)
- Update `buildProposalEmailHtml()` to use these tokens instead of hardcoded values

**File: `src/hooks/useCompanySettings.ts`**
- Extend the `email_style` type to include `body_color`, `heading_color`, `body_font_size`

**All 4 send paths** (SendProposalDialog, useProposals, ClientProposal, Gallery) already call `resolveEmailStyle()` — they'll automatically pick up the new tokens without any changes needed.

