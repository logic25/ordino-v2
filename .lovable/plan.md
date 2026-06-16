## Logo placement on the BD card

Going with your original instinct — logo sits in the white space under the cover, to the right of the profile photo. Cleanest co-branding without crowding the cover image. (Skipping the byline-under-name and footer-band options for now; we can swap later if you want.)

### What changes

1. **Remove** the white "GREEN LIGHT EXPEDITING" logo chip currently floating on the cover banner — frees the cover for the user's chosen background image.
2. **Add** the logo into the identity row, aligned to the bottom-right of the avatar. Sits on a soft white background so it reads on any cover color.
3. **Sizing:** logo ~28px tall, with the avatar staying 96px. Lock to the right edge of the card so the name still anchors left.
4. **Print/PDF:** logo remains visible in print so the saved card carries the brand.
5. **Hidden if there's no logo asset** (future-proof — for now we always show the GLE wordmark).

### Files touched

- `src/pages/bd/_bdcard/BdMyCardTab.tsx` — single file, ~10 lines net change. Remove the cover-chip block, add an `<img>` next to the `<Avatar>` inside the existing absolute-positioned identity wrapper.

No new dependencies, no schema changes, no logic changes. Purely presentational.
