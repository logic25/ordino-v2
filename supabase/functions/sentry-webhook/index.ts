import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, sentry-hook-signature, sentry-hook-resource",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Constant-time hex compare
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function verifySentrySignature(rawBody: string, headerSig: string | null, secret: string): Promise<boolean> {
  if (!headerSig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqualHex(hex, headerSig.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- Auth: fail-closed signature verification ----
  const secret = Deno.env.get("SENTRY_WEBHOOK_SECRET");
  if (!secret) {
    console.error("SENTRY_WEBHOOK_SECRET not configured — refusing request");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("sentry-hook-signature");
  const ok = await verifySentrySignature(rawBody, sig, secret);
  if (!ok) {
    console.warn("Sentry webhook signature mismatch");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = JSON.parse(rawBody);

    const action = body.action;
    if (!action) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const issueData = body.data?.issue || body.data?.event || {};
    const errorTitle = issueData.title || issueData.metadata?.type || "Unknown error";
    const errorMessage = issueData.metadata?.value || issueData.culprit || "";
    const tags = issueData.tags || [];
    const urlTag = tags.find((t: any) => t.key === "url" || t.key === "page");
    const _affectedPage = urlTag?.value || "";

    const userContext = issueData.user || {};
    const userEmail = userContext.email || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: patterns } = await supabase
      .from("bug_patterns")
      .select("*")
      .order("occurrences", { ascending: false })
      .limit(50);

    const searchText = `${errorTitle} ${errorMessage}`.toLowerCase();
    const matchedPattern = (patterns || []).find((p: any) => {
      const patternText = `${p.pattern_name} ${p.root_cause}`.toLowerCase();
      const words = searchText.split(/\s+/).filter((w: string) => w.length > 3);
      return words.some((w: string) => patternText.includes(w));
    });

    // Only insert a widget message if userEmail corresponds to a real profile.
    // This prevents injection of "assistant" messages for arbitrary addresses.
    if (userEmail) {
      const { data: knownProfile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("email", userEmail)
        .maybeSingle();

      if (knownProfile && knownProfile.company_id) {
        let proactiveMessage = `🔔 I noticed a JavaScript error on the page you were just on:\n\n**${errorTitle}**`;
        if (errorMessage) proactiveMessage += `\n${errorMessage}`;
        if (matchedPattern) {
          proactiveMessage += `\n\nThis matches a known pattern: **"${matchedPattern.pattern_name}"** (seen ${matchedPattern.occurrences}x before). Root cause: ${matchedPattern.root_cause || "under investigation"}.`;
          if (matchedPattern.fix_pattern) {
            proactiveMessage += ` Fix: ${matchedPattern.fix_pattern}`;
          }
        }
        proactiveMessage += `\n\nWas something not working correctly? Let me know and I can log it as a bug.`;

        await supabase.from("widget_messages").insert({
          user_email: userEmail,
          company_id: knownProfile.company_id,
          role: "assistant",
          content: proactiveMessage,
          metadata: {
            source: "sentry",
            error_title: errorTitle,
            matched_pattern: matchedPattern?.pattern_name || null,
            is_bug_report: true,
          },
        });

      } else {
        console.log(`Sentry alert for unknown email ${userEmail} — not inserting widget message`);
      }
    }

    console.log(`Sentry alert processed: "${errorTitle}" | pattern match: ${matchedPattern?.pattern_name || "none"}`);

    return new Response(JSON.stringify({ ok: true, matched_pattern: matchedPattern?.pattern_name || null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sentry webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
