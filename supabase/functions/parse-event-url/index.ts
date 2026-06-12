// parse-event-url: AI-powered event extractor from a URL or pasted email text.
// JWT auth (any signed-in user). Used by ProposeEventDialog.
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

async function fetchPage(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 OrdinoBot/1.0 (event parser)" },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    // Strip tags/scripts/styles -> readable text. Keep it cheap.
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  let body: { input?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const input = (body.input ?? "").trim();
  if (!input) return json({ error: "input required" }, 400);

  let source_url: string | null = null;
  let text = input;
  if (/^https?:\/\//i.test(input)) {
    source_url = input;
    try { text = await fetchPage(input); }
    catch (e) {
      console.warn("fetch failed, falling back to raw URL:", (e as Error).message);
      text = input;
    }
  }

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You extract NYC industry event details (real estate, construction, AEC) from text. " +
            "Only return values clearly present in the input — never invent. " +
            "Dates must be ISO (YYYY-MM-DD). " +
            "why_it_matters: one short sentence — why a NYC construction expediting firm (Green Light Expediting) might attend.",
        },
        { role: "user", content: `Source URL: ${source_url ?? "(none — raw text)"}\n\nContent:\n${text}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "event_details",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              start_date: { type: "string", description: "YYYY-MM-DD or null" },
              end_date: { type: "string" },
              location: { type: "string" },
              description: { type: "string" },
              event_type: {
                type: "string",
                enum: ["CONFERENCE", "NETWORKING", "WEBINAR", "ROUNDTABLE", "AWARD_CEREMONY", "OTHER"],
              },
              target_audience: { type: "string" },
              why_it_matters: { type: "string" },
              source_url: { type: "string" },
              cost_low: { type: "number" },
              cost_high: { type: "number" },
              cost_member: { type: "number" },
            },
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "event_details" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text().catch(() => "");
    console.error("gateway", aiRes.status, txt.slice(0, 300));
    if (aiRes.status === 429) return json({ error: "Rate limited — try again" }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
    return json({ error: "Could not extract event details" }, 400);
  }
  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(call?.function?.arguments ?? "{}"); }
  catch { return json({ error: "Could not extract event details" }, 400); }

  if (source_url && !parsed.source_url) parsed.source_url = source_url;

  return json(parsed);
});
