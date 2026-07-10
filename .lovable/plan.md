## Sync CONTENT_PUBLISH_SECRET on Ordino

Marketing site has rotated `CONTENT_PUBLISH_SECRET`. To restore the handshake, Ordino's edge function `publish-to-blog` needs the identical value in its own secret store.

### Step 1 — Open secure form
Call `update_secret` for `CONTENT_PUBLISH_SECRET`. A secure input appears in the chat; you paste the exact value the marketing site is using. The value is never logged, never echoed, and never visible to me — it just becomes available as `Deno.env.get("CONTENT_PUBLISH_SECRET")` inside the edge function.

### Step 2 — Redeploy `publish-to-blog`
Edge functions read env vars at cold start, so after the secret changes I'll redeploy `publish-to-blog` to guarantee it picks up the new value on the very next invocation instead of whenever its current instance recycles.

### Step 3 — You test-publish
You click Publish on a drafted candidate on `/content`. Expected outcomes:

- Success: toast shows the returned marketing-site URL, card flips to `published`, `generated_content.published_url` is set.
- 401 from marketing site: secrets don't match — we re-run Step 1.
- 409 from marketing site: slug collision on their side (a different candidate already used that slug) — separate issue, not a secret problem.

### Out of scope
- No code changes to `publish-to-blog/index.ts` — the payload contract is already correct (`external_candidate_ref` / `external_draft_ref`, 401/409/502 handling in `usePublish` via `data.error`).
- No changes to `MARKETING_SITE_URL`.
- No slug-editing UI in the publish dialog (parked; only becomes relevant if you hit a real 409).

Approve and I'll open the secure form, then redeploy the function.
