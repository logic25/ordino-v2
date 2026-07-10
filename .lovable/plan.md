## Two integrations between Ordino and the marketing site

Ordino V2 (this project) is the **workbench**. The marketing site is the **public face**. Two hand-offs cross between them:

```text
Marketing site  ──(1) lead from AI chat/booking──▶  Ordino  (receive-lead)
Ordino          ──(2) approved blog post──────────▶  Marketing site  (receive-post)
```

The AI chat, scheduler, and paid booking UI live on the marketing site and must be planned/approved in that project (`Greenlight Expediting Refresh`). This plan covers only the Ordino side.

---

### 1. Marketing site → Ordino (leads)

Already built here. The marketing project just needs to POST to `receive-lead`.

Contract the marketing site will use:

```text
POST https://<ordino-functions-host>/receive-lead
Headers:
  x-webhook-secret: <LEAD_WEBHOOK_SECRET>
Body:
  { first_name, last_name, email, phone, address,
    service_needed, description, source, company_slug: "nyc-permits-llc" }
```

Ordino side: I'll generate `LEAD_WEBHOOK_SECRET` here so the same value can be set on the marketing project.

---

### 2. Ordino → Marketing site (content publishing)

Today, clicking **Publish** on `/content` only flips `status = published` and lets you paste a `published_url` manually. To actually push the post to the blog after review:

Add a **two-step publish flow**:

1. **Approve** (admin-only) — draft → `approved` status. Nothing external happens yet; this is the human review gate.
2. **Publish to blog** — Ordino calls a new marketing-site endpoint `POST /functions/v1/receive-post` with the approved draft. Marketing site inserts a blog row and returns the live URL. Ordino saves that URL as `published_url` and flips status to `published`.

Contract Ordino will send:

```text
POST https://<marketing-site>/functions/v1/receive-post
Headers:
  x-webhook-secret: <CONTENT_PUBLISH_SECRET>
Body:
  { candidate_id, title, slug, content_type ("blog_post"|"newsletter"),
    body_markdown, excerpt, cover_image_url, cover_image_attribution,
    published_at }
Response:
  { url: "https://marketingsite.com/blog/the-slug" }
```

Newsletters get the same push for now — they land on the site as posts. When an email tool (Omnisend, etc.) is chosen later, that tool can read the same post record. **No email work in this plan.**

---

### Changes required in Ordino (this project)

1. **Fix `/content` counter** → "Ideas (30) · 117 skipped", with a collapsible Skipped section to review/restore.
2. **Add `approved` stage** to the pipeline UI — it's already in `STAGES`; wire an **Approve** button on drafted cards, admin-only.
3. **New edge function `publish-to-blog`** — takes a draft ID, POSTs to the marketing site's `receive-post` with the shared secret, stores the returned URL on the draft, marks published.
4. **Store three secrets** here: `LEAD_WEBHOOK_SECRET`, `CONTENT_PUBLISH_SECRET`, and `MARKETING_SITE_URL`. I'll generate the two secrets and give you the values to paste into the marketing project.
5. **No schema changes needed** — `generated_content.published_url` already exists.

---

### What the marketing site needs to add (for their own planning)

- `receive-lead` client call from the AI chat + booking flows (contract above).
- `receive-post` edge function that verifies `x-webhook-secret`, upserts a blog row keyed by `candidate_id`, and returns the public URL.
- A public `/blog` route that renders those rows.

---

### Out of scope for this plan

- Newsletter email sending (waiting on your email tool choice).
- AI chat, Stripe booking, and admin scheduler on the marketing site — those are that project's plan.
- RSS/pull-based sync — the two-way secret-signed push is simpler and gives Ordino the resulting URL immediately.

---

### Open item before build

1. Do you have the marketing project's Supabase project URL yet, or should I stub `MARKETING_SITE_URL` and you'll set it when the site is up?
2. Approve button — admin-only, or any role with Content access can approve?
