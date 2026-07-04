// research-market: AI-drafts expansion intel for a target market.
// JWT-auth (any signed-in user). Mirrors draft-event-strategy.
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

  let body: { market_name?: string; state?: string; tier?: number };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const name = (body.market_name ?? "").trim();
  const state = (body.state ?? "NY").trim();
  const tier = Number(body.tier);
  if (!name) return json({ error: "market_name required" }, 400);
  if (![1, 2, 3].includes(tier)) return json({ error: "tier must be 1, 2, or 3" }, 400);

  const tierContext = tier === 1
    ? "Tier 1 (NYC-adjacent — immediate expansion, similar to NYC DOB)"
    : tier === 2
    ? "Tier 2 (broader NY/NJ — moderate ramp-up)"
    : "Tier 3 (out-of-state — requires licensure or partner)";

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
            "You are a research assistant for Green Light Expediting (GLE), a NYC construction permit " +
            "expediting firm (DOB filings PW1/PW2/PW3, TR1/TR8, objection resolution, COs). GLE is " +
            "evaluating expansion into a new market. Be concrete and reference real agencies, real " +
            "code differences from NYC DOB, and real competitor types. If you do not know something " +
            "for sure, say so plainly — do not invent specifics.",
        },
        {
          role: "user",
          content:
            `Research the expansion target: ${name}, ${state} (${tierContext}). ` +
            `Return a concise intel briefing focused on what GLE needs to know to operate there.`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "market_intel",
          description: "Expansion intel for a new GLE market.",
          parameters: {
            type: "object",
            properties: {
              why_it_matters: {
                type: "string",
                description: "2-3 sentences on market opportunity for GLE specifically (volume, owner concentration, regulatory complexity that favors expediters).",
              },
              requirements: {
                type: "string",
                description: "Key licensing, filing, or regulatory differences vs NYC DOB. Mention agency name(s) and what credentials are needed.",
              },
              key_contacts: {
                type: "string",
                description: "Relevant agencies, building departments, or industry bodies in this market (real names).",
              },
              competitive_landscape: {
                type: "string",
                description: "Who else does expediting/permit work there — firm types, notable names if known, and how GLE could differentiate.",
              },
            },
            required: ["why_it_matters", "requirements", "key_contacts", "competitive_landscape"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "market_intel" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text().catch(() => "");
    console.error("gateway", aiRes.status, txt.slice(0, 300));
    if (aiRes.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    return json({ error: "Could not research market" }, 400);
  }

  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  const rawArgs = call?.function?.arguments ?? "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    // Resilience pattern: never crash — return raw + warning.
    return json({
      warning: "AI response could not be parsed as JSON; raw output preserved.",
      raw: typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs),
    });
  }

  return json({
    why_it_matters: (parsed.why_it_matters as string) ?? "",
    requirements: (parsed.requirements as string) ?? "",
    key_contacts: (parsed.key_contacts as string) ?? "",
    competitive_landscape: (parsed.competitive_landscape as string) ?? "",
  });
});
