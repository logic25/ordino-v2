## Two content-quality fixes

### 1. Photo credit — clickable and Unsplash-compliant

**Problem:** The live post shows raw markdown (`Photo by [Jack Cohen](https://…) on [Unsplash](…)`). My earlier fix collapses that to plain text — cleaner, but Unsplash's attribution rules require clickable links to the photographer and to Unsplash, with the `?utm_source=ordino&utm_medium=referral` params preserved.

**Approach — structured fields + one small marketing-side render change:**

1. In `publish-to-blog`, parse the existing markdown attribution string into structured fields and send them alongside the plain-text fallback:
   ```
   cover_image_credit: {
     photographer_name: "Jack Cohen",
     photographer_url:  "https://unsplash.com/@jackcohen?utm_source=ordino&utm_medium=referral",
     source_name:       "Unsplash",
     source_url:        "https://unsplash.com?utm_source=ordino&utm_medium=referral"
   }
   cover_image_attribution: "Photo by Jack Cohen on Unsplash"   // fallback / legacy
   ```
2. Hand the marketing team a short render snippet for their blog template:
   ```
   Photo by <a href={photographer_url} rel="noopener nofollow">{photographer_name}</a>
   on <a href={source_url} rel="noopener nofollow">{source_name}</a>
   ```
   With graceful fallback to `cover_image_attribution` when `cover_image_credit` is missing (old posts). Their `receive-post` just needs to persist the new object.
3. Republish the Storm Preparedness post to overwrite the live version.

### 2. [[CONFIRM: ...]] editorial placeholders — three layers of defense

**Problem:** The Newsletter draft title contains `[[CONFIRM: verify or remove the "objection rate" claim]]`. Beacon's content generator emits these as human-review markers; they should never reach the live site.

**Approach (prompt + auto-strip + publish guard):**

1. **Fix the generator prompt (Beacon side).** Beacon runs on Railway (separate platform), so I can't edit its prompt directly — I'll write the exact prompt-diff instruction for you to paste into Beacon's content-generation system prompt: *"Never emit `[[CONFIRM: ...]]`, `[[TODO: ...]]`, or bracketed editorial notes in the returned title or body. If a claim needs verification, either omit it or rephrase it as a hedged statement."*
2. **Auto-strip on save (Ordino).** In `useSaveDraft`, strip `/\[\[(?:CONFIRM|TODO|VERIFY|CHECK)[^\]]*\]\]/gi` from `title` and `content` before writing to `generated_content`, and collapse the resulting double spaces / stray punctuation. Same regex runs when a fresh draft comes back from `beacon-proxy?action=content-generate`, so placeholders never land in the DB.
3. **Publish guard (server + client).**
   - `publish-to-blog` edge function: if the resolved title or body still matches the regex, return `400` with `{ error: "Draft still contains [[CONFIRM: ...]] placeholders. Clean them up before publishing." }` and don't hit the marketing site.
   - Review modal (client): before firing the Publish mutation, run the same check and show a toast so the editor gets instant feedback instead of a round-trip error.
4. **One-time cleanup for the existing Newsletter draft.** In the review modal, when placeholders are detected, show a small inline banner listing each match plus a "Remove placeholders" button that applies the same strip + saves. You keep control; nothing edits your draft silently.

### Files touched

- `supabase/functions/publish-to-blog/index.ts` — attribution parser + structured payload + `[[CONFIRM]]` guard.
- `src/hooks/useContent.ts` — strip on `useSaveDraft` and on the `useGenerateDraft` result.
- `src/pages/Content.tsx` — placeholder banner + "Remove placeholders" action + pre-publish client check.
- No DB migration.

### Out of scope

- Rewriting attribution for previously-published posts other than by clicking Republish.
- Editing Beacon's system prompt (external service; I'll give you the exact text to paste).
- Any responsiveness / layout changes.
