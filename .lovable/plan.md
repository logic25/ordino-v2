## Polish the My QR Card

Three focused visual changes to the card, keeping the current layout.

### 1. Logo — proper size, right of avatar
- Shrink the wordmark from 28px to ~20px (`h-5`).
- Stay absolute-positioned in the white space to the right of the avatar, vertically aligned with the name. Right edge of the card, not centered.
- Never overlaps the cover image.

### 2. MBE gold seal — inside the QR/share block
- Add the new gold `mbe-seal.png` (~52px) to the right of the QR code in the footer block.
- Slow rotation: CSS `spin-slow` keyframes, ~16s per turn. Respects `prefers-reduced-motion` (static when disabled).
- Reads as a trust badge at the moment someone is about to save your contact.

### 3. Photo edit affordances — hover-only, no permanent chrome
- Remove the always-visible "Change cover / Reset" button bar from the cover.
- Remove the always-visible camera badge from the avatar.
- Add hover overlays: hovering the cover or avatar reveals a subtle frosted camera icon in the corner; tap on mobile shows it briefly. Clicking opens the file picker.
- Cover "Reset" moves into the existing Edit sheet.

### Files touched
- `src/pages/bd/_bdcard/BdMyCardTab.tsx` — logo size, hover overlays, MBE seal in QR block.
- `src/index.css` — `@keyframes spin-slow` + reduced-motion guard.
- `src/assets/mbe-seal.png` — already generated.

No schema, no dependencies, no logic changes.

### Deferred
- Networking / "who should I introduce you to" stays in the Leads flow as a separate future task.