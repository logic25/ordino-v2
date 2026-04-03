import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sentry-hook",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  try {
    const body = await req.json();

    // Sentry sends issue alerts with action = "created" or "triggered"
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
    const platform = issueData.platform || "javascript";
    const tags = issueData.tags || [];

    // Try to extract the affected page from tags or URL
    const urlTag = tags.find((t: any) => t.key === "url" || t.key === "page");
    const affectedPage = urlTag?.value || "";

    // Try to extract the user email from the issue context
    const userContext = issueData.user || {};
    const userEmail = userContext.email || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this matches a known bug pattern
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

    // If we can identify the user, insert a proactive Beacon message
    if (userEmail) {
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
        role: "assistant",
        content: proactiveMessage,
        metadata: {
          source: "sentry",
          error_title: errorTitle,
          matched_pattern: matchedPattern?.pattern_name || null,
          is_bug_report: true,
        },
      });
    }

    console.log(`Sentry alert processed: "${errorTitle}" | user: ${userEmail || "unknown"} | pattern match: ${matchedPattern?.pattern_name || "none"}`);

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
