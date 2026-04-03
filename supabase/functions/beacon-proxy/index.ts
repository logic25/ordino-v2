import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BEACON_API_URL = Deno.env.get("BEACON_API_URL") || "https://beaconrag.up.railway.app";
const BEACON_API_KEY = Deno.env.get("BEACON_ANALYTICS_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Health check doesn't require authentication
    if (action === "health") {
      const beaconRes = await fetch(`${BEACON_API_URL}/`, { method: "GET" });
      const responseBody = await beaconRes.text();
      return new Response(responseBody, {
        status: beaconRes.status,
        headers: { ...corsHeaders, "Content-Type": beaconRes.headers.get("Content-Type") || "application/json" },
      });
    }

    // Verify JWT for all other actions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For ingest, check admin role
    if (action === "ingest") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required for ingestion" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let beaconUrl: string;
    let beaconReqInit: RequestInit;

    if (action === "chat") {
      beaconUrl = `${BEACON_API_URL}/api/chat`;
      const body = await req.json();

      // ── Page & error context injection ──
      const projectCtx = body.project_context || {};
      const currentPage = projectCtx.currentPage || projectCtx.current_page || "";
      const recentErrors = projectCtx.recentErrors || projectCtx.recent_errors || [];

      // ── Bug Triage Sub-Agent routing ──
      const lastMessage = body.message || body.messages?.[body.messages?.length - 1]?.content || "";
      const isBugQuestion = /\b(bug|broken|error|crash|fail|not working|issue|fix|wrong|stuck|breaking|doesn't work|can't|cannot|won't)\b/i.test(lastMessage);

      // Inject page context directly into the message so the LLM always sees it
      if (currentPage) {
        const msgField = body.message || "";
        let prefix = `[User is on the "${currentPage}" page in Ordino]`;
        if (recentErrors.length > 0) {
          prefix += `\n[Recent errors: ${recentErrors.join("; ")}]`;
        }
        body.message = `${prefix}\n${msgField}`;

        // Keep system_context as belt-and-suspenders fallback
        body.system_context = (body.system_context || "") +
          `\n\n**User Context:** Currently on the "${currentPage}" page.`;
      } else if (recentErrors.length > 0) {
        body.system_context = (body.system_context || "") +
          `\n\n**Recent Browser Errors:**\n${recentErrors.map((e: string) => `• ${e}`).join("\n")}`;
      }

      if (isBugQuestion) {
        // Inject bug detection instruction directly into message so LLM always sees it
        body.message = body.message + `\n\n[SYSTEM INSTRUCTION: If the user is reporting a genuine software bug, error, or broken feature, you MUST include the exact marker <!--BUG_REPORT--> at the very end of your response. Only include this for actual bugs/errors, NOT for general questions or how-to queries.]`;

        body.system_context = (body.system_context || "") +
          `\n\n**Bug Detection:** If the user is reporting a genuine software bug, error, or broken feature, include the exact marker \`<!--BUG_REPORT-->\` at the very end of your response.`;

        try {
          const dataProxyUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/beacon-data-proxy";
          const patternRes = await fetch(dataProxyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-beacon-key": BEACON_API_KEY,
            },
            body: JSON.stringify({
              action: "query_bug_patterns",
              params: { search: lastMessage, limit: 5 },
            }),
          });

          if (patternRes.ok) {
            const patternData = await patternRes.json();
            const patterns = patternData?.data?.patterns || [];
            if (patterns.length > 0) {
              const patternContext = patterns.map((p: any) =>
                `• "${p.pattern_name}" (seen ${p.occurrences}x): Root cause: ${p.root_cause || "unknown"}. Fix: ${p.fix_pattern || "N/A"}. Files: ${(p.affected_files || []).join(", ")}`
              ).join("\n");

              body.system_context = (body.system_context || "") +
                `\n\n**Known Bug Patterns (institutional knowledge):**\n${patternContext}\n\nUse these patterns to inform your answer. If a pattern matches the user's question, cite it specifically ("I've seen this pattern X times before...").`;
            }
          }
        } catch (e) {
          console.error("Bug pattern lookup failed (non-blocking):", e);
        }
      }

      beaconReqInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: JSON.stringify(body),
      };

      // Send to Beacon, then parse response for bug flag
      const beaconRes = await fetch(beaconUrl, beaconReqInit);
      const responseText = await beaconRes.text();

      try {
        const responseJson = JSON.parse(responseText);
        // Check for bug marker in the response text
        const hasBugMarker = (responseJson.response || "").includes("<!--BUG_REPORT-->");
        if (hasBugMarker) {
          responseJson.response = responseJson.response.replace("<!--BUG_REPORT-->", "").trimEnd();
          responseJson.is_bug_report = true;
        } else {
          responseJson.is_bug_report = false;
        }

        return new Response(JSON.stringify(responseJson), {
          status: beaconRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        // If not JSON, return as-is
        return new Response(responseText, {
          status: beaconRes.status,
          headers: { ...corsHeaders, "Content-Type": beaconRes.headers.get("Content-Type") || "application/json" },
        });
      }

    } else if (action === "create-bug") {
      // ── Conversational bug creation ──
      const body = await req.json();
      const dataProxyUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/beacon-data-proxy";

      // Get user's profile for company_id
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bugRes = await fetch(dataProxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-beacon-key": BEACON_API_KEY,
        },
        body: JSON.stringify({
          action: "create_bug_from_conversation",
          params: {
            title: body.title,
            description: body.description,
            page: body.page,
            ai_diagnosis: body.ai_diagnosis,
            reporter_id: profile.id,
            company_id: profile.company_id,
          },
        }),
      });

      const bugData = await bugRes.text();
      return new Response(bugData, {
        status: bugRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "ingest") {
      beaconUrl = `${BEACON_API_URL}/api/ingest`;
      const formData = await req.formData();
      beaconReqInit = {
        method: "POST",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: formData,
      };
    } else if (action === "knowledge-list") {
      beaconUrl = `${BEACON_API_URL}/api/knowledge/list`;
      beaconReqInit = {
        method: "GET",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
      };
    } else if (action === "file-content") {
      const sourceFile = url.searchParams.get("source_file") || "";
      beaconUrl = `${BEACON_API_URL}/api/knowledge/file-content?source_file=${encodeURIComponent(sourceFile)}`;
      beaconReqInit = {
        method: "GET",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
      };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const beaconRes = await fetch(beaconUrl!, beaconReqInit!);
    const responseBody = await beaconRes.text();

    return new Response(responseBody, {
      status: beaconRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": beaconRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    console.error("Beacon proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
