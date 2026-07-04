// Attach auto-captured evidence (screenshot, gzipped HTML, network failures,
// browser metadata) to a bug feature_request row. Called by BeaconChatWidget
// immediately after Beacon auto-logs a bug.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { bug_id, screenshot_b64, html_gz_b64, network, ua, viewport, url } = body || {};
    if (!bug_id || typeof bug_id !== "string") {
      return new Response(JSON.stringify({ error: "bug_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller's company owns the bug.
    const { data: profile } = await admin
      .from("profiles").select("id, company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: bug } = await admin
      .from("feature_requests")
      .select("id, company_id, description, attachments")
      .eq("id", bug_id).maybeSingle();
    if (!bug || bug.company_id !== profile.company_id) {
      return new Response(JSON.stringify({ error: "Bug not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachments: Array<{ url: string; name: string; type: string; auto?: boolean }> =
      Array.isArray(bug.attachments) ? [...(bug.attachments as any[])] : [];

    const basePath = `${profile.company_id}/${bug_id}/auto-${Date.now()}`;

    if (screenshot_b64) {
      const bytes = b64ToBytes(screenshot_b64);
      const path = `${basePath}-screenshot.jpg`;
      const { error } = await admin.storage.from("bug-attachments")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (!error) {
        const { data: urlData } = admin.storage.from("bug-attachments").getPublicUrl(path);
        attachments.push({ url: urlData.publicUrl, name: "auto-screenshot.jpg", type: "image/jpeg", auto: true });
      } else {
        console.warn("screenshot upload failed", error.message);
      }
    }

    if (html_gz_b64) {
      const bytes = b64ToBytes(html_gz_b64);
      const path = `${basePath}-page.html.gz`;
      const { error } = await admin.storage.from("bug-attachments")
        .upload(path, bytes, { contentType: "application/gzip", upsert: true });
      if (!error) {
        const { data: urlData } = admin.storage.from("bug-attachments").getPublicUrl(path);
        attachments.push({ url: urlData.publicUrl, name: "auto-page.html.gz", type: "application/gzip", auto: true });
      } else {
        console.warn("html upload failed", error.message);
      }
    }

    const netLines = Array.isArray(network) && network.length
      ? network.map((n: any) => `  - ${n.status || "ERR"} ${n.url} (${n.ms}ms)`).join("\n")
      : "  (none in last 30s)";
    const ctxBlock = `\n\n---\n**Auto-captured context:**\n- URL: ${url || "?"}\n- Viewport: ${viewport?.w || "?"}x${viewport?.h || "?"} @${viewport?.dpr || 1}x\n- User Agent: ${ua || "?"}\n- Recent network failures:\n${netLines}`;

    const newDescription = (bug.description || "") + ctxBlock;

    await admin.from("feature_requests")
      .update({ attachments, description: newDescription })
      .eq("id", bug_id);

    return new Response(JSON.stringify({ ok: true, attached: attachments.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("attach-bug-evidence error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
