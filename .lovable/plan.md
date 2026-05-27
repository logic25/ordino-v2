## What we know

- Chris ticked an attachment checkbox in the RFP builder, sent the RFP to himself, and the email arrived with no file attached.
- `gmail-send` edge function logs at 18:42:50Z explicitly show `gmail-send: no attachments` for that send — i.e. the frontend is invoking the edge function **without** any attachments in the body.
- Frontend code in `RfpBuilderDialog.tsx` *looks* correct: it filters `rfpAttachments` by `selectedAttachmentIds`, downloads each from `rfp-documents` storage, base64-encodes, and passes them to `gmail-send`.

So either (a) `selectedAttachmentIds` is empty at submit time, (b) `filteredRfpAttachments` resolves to 0, (c) every storage download is silently failing inside the try/catch, or (d) the `content` payload shape is different from what we expect (e.g. JSON string instead of object, so `c?.file_path` is undefined).

We don't currently have enough logging to distinguish these.

## Plan

1. **Add diagnostic logging to `handleSubmitViaEmail` in `src/components/rfps/RfpBuilderDialog.tsx`** so we can see exactly what's happening client-side on next attempt:
   - Log `selectedAttachmentIds`, `rfpAttachments.length`, and `filteredRfpAttachments.length` at the top of the handler.
   - For each attachment, log the resolved `file_path`, `filename`, whether `content` was an object or a string (and parse it if it's a string), and any download error.
   - Log the final `attachments.length` right before invoking `gmail-send`.

2. **Harden the attachment-content parsing** so if `att.content` is ever a JSON string (Postgres `jsonb` can sometimes round-trip that way), we still extract `file_path`. Same hardening for cert/staff content paths, since those are coded identically.

3. **Add a server-side log of incoming body keys** in `supabase/functions/gmail-send/index.ts` (one line: `console.log("gmail-send: body keys", Object.keys(reqBody), "attachments_in_body:", Array.isArray(reqBody.attachments) ? reqBody.attachments.length : typeof reqBody.attachments)`). This confirms whether the field is being dropped in transit vs never sent.

4. **Tell Chris to retry one send** so we capture the diagnostics. Based on what the logs show, either:
   - Selection state is empty → fix the state/selection bug.
   - Download is failing → fix the storage path / signed-URL flow.
   - Content shape mismatch → the parsing hardening in step 2 will already fix it.

5. Remove the noisy diagnostic logs (keep the one-line summary log) once the root cause is fixed.

## Technical details

- Files touched:
  - `src/components/rfps/RfpBuilderDialog.tsx` — add logs in `handleSubmitViaEmail` (around lines 232–348); harden `content` parsing for cert / staff / attachment loops.
  - `supabase/functions/gmail-send/index.ts` — add one `console.log` near line 454 where `reqBody` is destructured.
- No schema changes, no UI changes visible to the user.
- The hardening also covers the case where `useRfpContent` returns content as `string` (we'll do `typeof c === "string" ? JSON.parse(c) : c`).
- Once we have one diagnostic send from Chris, the fix is likely a 5-line change and the logs come back out.

No other code paths are affected.