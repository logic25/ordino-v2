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
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const marketingSiteUrl = Deno.env.get("MARKETING_SITE_URL")?.replace(/\/$/, "");
  const publishSecret = Deno.env.get("CONTENT_PUBLISH_SECRET");

  try {
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
    const body = draft.content || "";
    const contentType = draft.content_type || candidate.content_type || "blog_post";
    const excerpt = firstParagraph(body);
    const publishedAt = new Date().toISOString();

    let publishedUrl: string | null = null;

    if (marketingSiteUrl && publishSecret) {
      const payload = {
        candidate_id,
        draft_id,
        title,
        slug,
        content_type: contentType,
        body_markdown: body,
        excerpt,
        cover_image_url: draft.cover_image_url || null,
        cover_image_attribution: draft.cover_image_attribution || null,
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
