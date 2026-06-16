
## Batch 1 — My Card cleanup (frontend only)

**File:** `src/pages/bd/_bdcard/BdMyCardTab.tsx`

- Remove the always-visible logo tuner panel and the standalone **Save (.vcf)** button below the card.
- Add an **Edit** toggle in the tab header (pencil icon → "Done").
- One `isEditing` state drives:
  - Camera overlays on cover + avatar (tap to change photo) only show when editing.
  - A small **Sliders** icon button appears top-right of the card opening a popover with the 4 logo sliders (height, width, top, right) + Reset, still persisted to `localStorage` under `qr-card-logo-cfg`.
  - When not editing: clean card, no overlays, no tuner.
- QR action row: remove **Save (.vcf)** (nonsensical on own card). Keep **Share** wired to `navigator.share({ title, text, url })` with fallback to `navigator.clipboard.writeText` + toast. On desktop (no `navigator.share`), label it **Copy link**.

## Batch 2 — Public visitor card

**Backend (one migration):**

- `bd_cards` table: `id`, `user_id`, `company_id`, `slug` (unique), `fields` (jsonb: name, title, phones, emails, address, etc.), `photo_url`, `cover_url`, `logo_cfg` (jsonb), `published` bool, timestamps.
- GRANTs: `authenticated` full, `service_role` all, `anon` SELECT (needed for public read).
- RLS:
  - anon/authenticated SELECT where `published = true`
  - authenticated INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- `updated_at` trigger.

**Frontend:**

- New route `/c/:slug` → `src/pages/PublicBdCard.tsx`, lazy, wrapped in `PublicRoute`.
- Page fetches `bd_cards` by slug where `published = true`, renders read-only card visually identical to My Card (same logo/cover/avatar/QR-less layout), with a **Save contact** button that builds a `.vcf` blob client-side and downloads it. Also a **Share** button.
- No Beacon, no auth UI, no edit affordances.
- SEO: `<title>{name} — {company}</title>`, meta description, OG tags from fields.

**My Card wiring after Batch 2:**

- On first load, ensure a `bd_cards` row exists for the user (auto-create draft with generated slug from name).
- Edit mode gets a **Publish** toggle (writes `published`) and shows the public URL with copy button.
- QR encodes `https://ordinopm.com/c/<slug>` instead of inline vCard.
- Share button shares that URL.

## Out of scope

- Beacon on the public page
- `BdScanTab` and other BD tabs
- Analytics / view tracking (can add `bd_card_views` later)

## Technical notes

- vCard build: small helper `buildVcf(fields)` reused between My Card preview download (if ever needed) and Public page Save contact.
- Slug generation: `slugify(name) + '-' + 4 random chars`; uniqueness enforced by DB constraint with retry on conflict.
- Logo cfg persistence migrates from localStorage to `bd_cards.logo_cfg` once the row exists; localStorage stays as fallback for unauthenticated render.
