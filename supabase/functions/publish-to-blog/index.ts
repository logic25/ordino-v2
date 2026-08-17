import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "");
}

function firstParagraph(markdown: string) {
  const plain = markdown
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
  const first = plain.split(/\n{2,}/)[0] || plain;
  return first.slice(0, 240).trimEnd() + (first.length > 240 ? "…" : "");
}

// Marketing site renders the cover image + attribution from cover_image_url /
// cover_image_attribution. The draft body also has that block embedded
// (Content.tsx inserts it for in-app preview), so strip it before publishing to
// avoid the hero image + attribution rendering twice on the live post.
function stripLeadingCoverBlock(markdown: string) {
  return markdown.replace(
    /^\s*!\[[^\]]*\]\([^)]+\)\s*\n+(?:\*Photo by [^\n]+\*\s*\n+)?/,
    ""
  );
}

// Shorten a markdown-linked Unsplash/Pexels credit
// ("Photo by [Jack Cohen](https://…) on [Unsplash](https://…)") to plain text
// ("Photo by Jack Cohen on Unsplash") for legacy consumers that don't render
// the structured credit object.
function plainAttribution(attr: string | null): string | null {
  if (!attr) return null;
  return attr.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

// Parse an Unsplash/Pexels-style markdown attribution string
// ("Photo by [Jack Cohen](https://…) on [Unsplash](https://…)")
// into structured fields so the marketing site can render real <a> tags
// (Unsplash's attribution guidelines require clickable links back to the
// photographer and source, with utm params preserved).
function parseAttribution(attr: string | null): null | {
  photographer_name: string;
  photographer_url: string | null;
  source_name: string;
  source_url: string | null;
} {
  if (!attr) return null;
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: Array<{ name: string; url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(attr)) !== null) links.push({ name: m[1], url: m[2] });
  // Expect: "Photo by [name](url) on [source](url)"
  const plain = attr.replace(linkRe, "$1");
  const match = plain.match(/^Photo by\s+(.+?)\s+on\s+(.+?)\.?\s*$/i);
  if (!match) return null;
  const [, photographerName, sourceName] = match;
  const photographer = links.find((l) => l.name === photographerName) ?? links[0];
  const source = links.find((l) => l.name === sourceName) ?? links[1];
  return {
    photographer_name: photographerName.trim(),
    photographer_url: photographer?.url ?? null,
    source_name: sourceName.trim(),
    source_url: source?.url ?? null,
  };
}

// Editorial placeholders emitted by the content generator for human review
// (e.g. "[[CONFIRM: verify or remove the objection rate claim]]"). These must
// never reach the live site. Server-side guard mirrors the client pre-check;
// both use the same regex so the failure modes stay in sync.
const EDITORIAL_PLACEHOLDER_RE = /\[\[(?:CONFIRM|TODO|VERIFY|CHECK|FACT-?CHECK)\b[^\]]*\]\]/i;
function findEditorialPlaceholders(text: string): string[] {
  const re = new RegExp(EDITORIAL_PLACEHOLDER_RE.source, "gi");
  return text.match(re) || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const marketingSiteUrl = Deno.env.get("MARKETING_SITE_URL")?.replace(/\/$/, "");
  const publishSecret = Deno.env.get("CONTENT_PUBLISH_SECRET");

  try {
    // Authz: pushing generated_content live to the public marketing blog is a
    // staff-only action. The gateway verifies the JWT (verify_jwt defaults true),
    // but that only proves the caller is *some* authenticated principal — it does
    // not prove they are GLE staff. Confirm staff role here so an ordinary
    // authenticated user can't publish to the blog. Mirrors send-portal-invite.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: staffCheck, error: staffErr } = await supabase.rpc("is_gle_staff", {
      _uid: claims.claims.sub,
    });
    if (staffErr || staffCheck !== true) {
      return new Response(JSON.stringify({ error: "Forbidden: staff only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { draft_id, candidate_id } = await req.json();
    if (!draft_id || !candidate_id) {
      return new Response(JSON.stringify({ error: "draft_id and candidate_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the draft and candidate (service-role bypasses RLS).
    const { data: draft, error: draftErr } = await supabase
      .from("generated_content")
      .select("id, title, content, content_type, word_count, cover_image_url, cover_image_attribution, candidate_id, company_id")
      .eq("id", draft_id)
      .eq("candidate_id", candidate_id)
      .single();

    if (draftErr || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidate, error: candErr } = await supabase
      .from("content_candidates")
      .select("id, title, content_type, key_topics, reasoning")
      .eq("id", candidate_id)
      .single();

    if (candErr || !candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = draft.title || candidate.title || "Untitled";
    const slug = slugify(title);
    const rawBody = draft.content || "";
    const body = stripLeadingCoverBlock(rawBody);
    const contentType = draft.content_type || candidate.content_type || "blog_post";
    const excerpt = firstParagraph(body);
    const publishedAt = new Date().toISOString();

    // Editorial-placeholder guard: never publish drafts that still contain
    // "[[CONFIRM: …]]" / "[[TODO: …]]" style human-review markers. Mirrors the
    // client pre-check in Content.tsx so a bypass (curl, older UI, etc.) still
    // fails safely.
    const placeholders = [
      ...findEditorialPlaceholders(title),
      ...findEditorialPlaceholders(body),
    ];
    if (placeholders.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Draft still contains editorial placeholders (${placeholders.slice(0, 3).join(", ")}). Remove them before publishing.`,
          placeholders,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let publishedUrl: string | null = null;

    // ⚠️ DO NOT pipe published posts into the Beacon KB (/api/ingest).
    // The KB must hold only authoritative primary sources (DOB rules, code, our
    // real documents). Ingesting our own generated posts creates a
    // self-referential loop — the model would cite its own prior output as
    // authoritative and any error would seed the next post. Direction is
    // one-way: KB validates posts (via /api/content/generate RAG); posts
    // never feed the KB.
    if (marketingSiteUrl && publishSecret) {
      const credit = parseAttribution(draft.cover_image_attribution);
      const payload = {
        external_candidate_ref: candidate_id,
        external_draft_ref: draft_id,
        title,
        slug,
        content_type: contentType,
        body_markdown: body,
        excerpt,
        cover_image_url: draft.cover_image_url || null,
        // Legacy plain-text fallback for older marketing-site templates.
        cover_image_attribution: plainAttribution(draft.cover_image_attribution),
        // Structured credit for the new template — renders as real <a> tags.
        cover_image_credit: credit,
        // Flat fields the marketing site's receive-post reads directly to render
        // compliant "Photo by [name] on Unsplash" links with UTM params.
        photographer_name: credit?.photographer_name ?? null,
        photographer_url: credit?.photographer_url ?? null,
        image_source_url: credit?.source_url ?? null,
        published_at: publishedAt,
        key_topics: candidate.key_topics || [],
        reasoning: candidate.reasoning || null,
      };

      const resp = await fetch(`${marketingSiteUrl}/functions/v1/receive-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": publishSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "Unknown error");
        return new Response(JSON.stringify({ error: `Marketing site publish failed: ${text}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await resp.json().catch(() => ({}));
      publishedUrl = result?.url || null;
    }

    // Mark both the draft and candidate as published.
    const { error: updateDraftErr } = await supabase
      .from("generated_content")
      .update({
        status: "published",
        published_url: publishedUrl,
        published_at: publishedAt,
      })
      .eq("id", draft_id);

    if (updateDraftErr) {
      return new Response(JSON.stringify({ error: "Failed to mark draft as published" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateCandErr } = await supabase
      .from("content_candidates")
      .update({
        status: "published",
        updated_at: publishedAt,
      })
      .eq("id", candidate_id);

    if (updateCandErr) {
      return new Response(JSON.stringify({ error: "Failed to mark candidate as published" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        published_url: publishedUrl,
        published_at: publishedAt,
        message: publishedUrl
          ? `Published to ${publishedUrl}`
          : "Marked as published (no marketing site URL configured).",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("publish-to-blog error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
