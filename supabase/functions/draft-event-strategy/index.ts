// draft-event-strategy: AI-drafts the 4 Strategy fields for a BD event.
// JWT-auth (any signed-in user). Mirrors parse-event-url pattern.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: {
    event_name?: string;
    source_url?: string | null;
    category?: string | null;
    target_audience?: string | null;
    why_it_matters?: string | null;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const eventName = (body.event_name ?? "").trim();
  if (!eventName) return json({ error: "event_name required" }, 400);

  const context = [
    `Event: ${eventName}`,
    body.source_url ? `Source URL: ${body.source_url}` : null,
    body.category ? `Category: ${body.category}` : null,
    body.target_audience ? `Target audience: ${body.target_audience}` : null,
    body.why_it_matters ? `Existing notes on why it matters: ${body.why_it_matters}` : null,
  ].filter(Boolean).join("\n");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a BD strategist at Green Light Expediting (GLE), a NYC construction expediting firm " +
            "(DOB permits, PW1/PW2 filings, objections, COs). You help GLE prep for industry events by " +
            "drafting concise, GLE-specific strategy notes. Be concrete, NYC-focused, and avoid generic " +
            "advice. If you do not know something for sure (e.g. specific attendees or recent news), say " +
            "so and suggest where to look. Each field: 2–4 short sentences.",
        },
        {
          role: "user",
          content:
            `Draft the four BD strategy fields for this event from GLE's perspective.\n\n${context}`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "event_strategy",
          description: "GLE-specific BD strategy fields for this event.",
          parameters: {
            type: "object",
            properties: {
              why_it_matters: {
                type: "string",
                description:
                  "Why is this worth GLE's time? Tie to DOB filings, owner relationships, or specific NYC market angle.",
              },
              recent_news: {
                type: "string",
                description:
                  "Any recent news around this event/organizer/market segment relevant to BD. If unknown, say what to search.",
              },
              key_attendees: {
                type: "string",
                description:
                  "Who specifically should GLE talk to (titles/firm types). If specific attendee list unknown, list firm types likely there.",
              },
              competitive_landscape: {
                type: "string",
                description:
                  "Other expediters / competitors likely in the room and how GLE can stand out.",
              },
              talking_points: {
                type: "array",
                items: { type: "string" },
                description:
                  "3-6 short opening lines or hooks GLE reps can use in conversation. Each ≤140 chars, concrete, NYC-specific (e.g. reference a recent rule, ZR amendment, or DOB filing trend).",
              },
            },
            required: [
              "why_it_matters", "recent_news", "key_attendees",
              "competitive_landscape", "talking_points",
            ],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "event_strategy" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text().catch(() => "");
    console.error("gateway", aiRes.status, txt.slice(0, 300));
    if (aiRes.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    return json({ error: "Could not draft strategy" }, 400);
  }

  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(call?.function?.arguments ?? "{}"); }
  catch {
    return json({ error: "Could not parse AI response" }, 400);
  }

  return json({
    why_it_matters: (parsed.why_it_matters as string) ?? "",
    recent_news: (parsed.recent_news as string) ?? "",
    key_attendees: (parsed.key_attendees as string) ?? "",
    competitive_landscape: (parsed.competitive_landscape as string) ?? "",
    talking_points: Array.isArray(parsed.talking_points)
      ? (parsed.talking_points as unknown[]).map((s) => String(s)).filter(Boolean)
      : [],
  });
});

