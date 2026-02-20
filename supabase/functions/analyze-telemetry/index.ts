import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { mode, raw_idea, company_id, exclude_item_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch current roadmap items for duplicate detection, excluding the item being tested
    const roadmapQuery = supabase
      .from("roadmap_items")
      .select("id, title, description")
      .eq("company_id", company_id);
    const { data: roadmapItems } = await roadmapQuery;

    const { data: existingSuggestions } = await supabase
      .from("ai_roadmap_suggestions")
      .select("title")
      .eq("company_id", company_id)
      .eq("status", "pending_review");

    // Filter out the item being stress-tested so it doesn't flag itself as a duplicate
    const filteredRoadmapItems = (roadmapItems || []).filter((r: any) => r.id !== exclude_item_id);
    const roadmapTitles = filteredRoadmapItems.map((r: any) => r.title).join(", ");
    const suggestionTitles = (existingSuggestions || []).map((s: any) => s.title).join(", ");

    let systemPrompt = "";
    let userMessage = "";

    if (mode === "telemetry") {
      // Fetch last 30 days of telemetry, aggregated
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabase
        .from("telemetry_events")
        .select("page, action, session_id, user_id, metadata")
        .eq("company_id", company_id)
        .gte("created_at", thirtyDaysAgo);

      if (!events || events.length === 0) {
        return new Response(
          JSON.stringify({ suggestions: [], message: "No telemetry data found in the last 30 days." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Aggregate: count by (page, action) and detect sessions
      const aggregated: Record<string, { count: number; sessions: Set<string>; users: Set<string> }> = {};
      for (const ev of events) {
        const key = `${ev.page}__${ev.action}`;
        if (!aggregated[key]) aggregated[key] = { count: 0, sessions: new Set(), users: new Set() };
        aggregated[key].count++;
        if (ev.session_id) aggregated[key].sessions.add(ev.session_id);
        if (ev.user_id) aggregated[key].users.add(ev.user_id);
      }

      const aggregatedRows = Object.entries(aggregated).map(([key, val]) => ({
        event: key,
        count: val.count,
        unique_sessions: val.sessions.size,
        unique_users: val.users.size,
      }));

      systemPrompt = `You are a senior product analyst for Ordino — a construction permit expediting CRM used daily by project managers, accountants, and admins in NYC. The app has these modules: Invoices, Proposals, Projects, Properties, Emails, Time, RFPs, Clients, Calendar, Reports, Dashboard, Settings.

You will receive aggregated telemetry data showing what users actually do and where they stop. Analyze patterns and surface ONLY concrete, evidence-backed product gaps.

SIGNAL TYPES TO DETECT:
1. DROP-OFF: A "_started" event exists with significantly higher count than its matching "_completed" event → user abandoned the flow. Formula: (started_count - completed_count) / started_count > 0.3 = significant
2. REPETITION LOOPS: Same action appearing from many unique sessions → users confused or retrying something broken
3. DEAD ZONES: Page visited (page views) but very few sub-actions logged → users land here but find no clear next step
4. FEATURE BLINDNESS: Core features with very low adoption relative to parent page views → discoverability issue
5. ERROR CLUSTERS: _failed or _error events appearing consistently → broken experience

PRIORITY SCORING RULES (be strict — do not inflate):
- high: affects >3 distinct users OR involves invoices/billing/send flows
- medium: affects 2–3 users OR involves core workflow (proposals, projects, time)
- low: single user, non-revenue-impacting

DUPLICATE DETECTION: Compare against existing_roadmap_items and existing_suggestions. If title overlap >70%, set duplicate_warning to the matching item title and do NOT create the suggestion.

OUTPUT FORMAT: Return ONLY a valid JSON array. Max 5 suggestions. Only include items with clear evidence.
Each item must have: title, description, category, priority, evidence, duplicate_warning (or null), challenges (array of 2-4 objects, each with "problem" string and "solution" string).
category must be one of: "billing", "projects", "integrations", "operations", "general"`;


      userMessage = `Telemetry data (last 30 days, aggregated):
${JSON.stringify(aggregatedRows, null, 2)}

Total events analyzed: ${events.length}
Existing roadmap items: ${roadmapTitles || "none"}
Existing pending suggestions: ${suggestionTitles || "none"}

Analyze and return JSON array of gap suggestions.`;
    } else if (mode === "idea") {
      systemPrompt = `You are a senior product analyst for Ordino — a construction permit expediting CRM used daily by project managers, accountants, and admins in NYC. The app has these modules: Invoices, Proposals, Projects, Properties, Emails, Time, RFPs, Clients, Calendar, Reports, Dashboard, Settings.

A user has submitted a product idea. Your job is to stress-test it: challenge assumptions, surface edge cases, detect duplicates, score priority based on domain context.

DUPLICATE DETECTION: Compare against existing_roadmap_items. If overlap >70%, set duplicate_warning.
PRIORITY: high (directly impacts revenue/billing), medium (core workflow), low (nice-to-have)

OUTPUT FORMAT: Return ONLY a valid JSON array with exactly 1 item containing: title (refined), description (problem-first, 1-2 sentences), category, priority, evidence (why this matters based on the app context), duplicate_warning (or null), challenges (array of 2-4 objects, each with "problem" string and "solution" string).
category must be one of: "billing", "projects", "integrations", "operations", "general"`;

      userMessage = `Raw idea: "${raw_idea}"
Existing roadmap items: ${roadmapTitles || "none"}
Stress-test this idea and return a JSON array with 1 structured suggestion.`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: corsHeaders });
    }

    const MODEL = "google/gemini-3-flash-preview";
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: corsHeaders });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), { status: 402, headers: corsHeaders });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "[]";

    // Log usage
    try {
      const sbAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const usage = aiData.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
      // Gemini Flash pricing: $0.075/1M input, $0.30/1M output
      const estimatedCost = (promptTokens * 0.075 + completionTokens * 0.30) / 1_000_000;
      const userId = claimsData?.claims?.sub;
      const { data: prof } = await sbAdmin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      await sbAdmin.from("ai_usage_logs").insert({
        company_id,
        user_id: prof?.id || null,
        feature: mode === "telemetry" ? "telemetry_analysis" : "stress_test",
        model: MODEL,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: estimatedCost,
      });
    } catch (logErr) {
      console.error("Failed to log AI usage:", logErr);
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawContent.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();

    let suggestions: any[] = [];
    try {
      suggestions = JSON.parse(jsonStr);
      if (!Array.isArray(suggestions)) suggestions = [suggestions];
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: rawContent }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-telemetry error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
