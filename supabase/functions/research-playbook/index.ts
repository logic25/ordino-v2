// research-playbook: AI-drafts per-slot answers for a permit playbook.
// Returns one suggestion per question; missing info => empty answer + confidence 0.
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

type Question = { id: string; question: string; kind?: string };

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

  let body: { market_name?: string; state?: string; permit_type?: string; questions?: Question[] };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const name = (body.market_name ?? "").trim();
  const state = (body.state ?? "").trim();
  const permit_type = (body.permit_type ?? "").trim();
  const questions = Array.isArray(body.questions) ? body.questions : [];

  if (!name) return json({ error: "market_name required" }, 400);
  if (!permit_type) return json({ error: "permit_type required" }, 400);
  if (questions.length === 0) return json({ suggestions: [] });

  const qList = questions
    .map((q, i) => `${i + 1}. (id="${q.id}") ${q.question}`)
    .join("\n");

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
            "You are a research assistant for Green Light Expediting, a permit-expediting firm. " +
            "You are drafting reference answers for a permit playbook that humans will verify before relying on. " +
            "CRITICAL RULES: " +
            "1) Do NOT invent specifics. If you do not know a fee, phone number, URL, or rule for sure, " +
            "return an empty answer and confidence 0 for that question. " +
            "2) Prefer the official municipal building department source. Cite the URL in `source`. " +
            "3) Keep answers concise (1-3 sentences). " +
            "4) `confidence` is 0-1: 0.9+ only if the official source confirms it; 0.5-0.8 for reasonable inference; " +
            "below 0.5 if uncertain; 0 if you don't know. " +
            "5) Always return one entry per question id provided, in the same order.",
        },
        {
          role: "user",
          content:
            `Jurisdiction: ${name}${state ? `, ${state}` : ""}\n` +
            `Permit type: ${permit_type}\n\n` +
            `Answer each question for this jurisdiction + permit type:\n${qList}`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "playbook_answers",
          description: "Draft answers for permit playbook slots.",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "The slot id, exactly as provided in the question list." },
                    answer: { type: "string", description: "Draft answer (1-3 sentences). Empty string if unknown." },
                    source: { type: "string", description: "Source URL (official municipal site preferred). Empty if none." },
                    confidence: { type: "number", description: "0-1. Use 0 when unknown." },
                  },
                  required: ["id", "answer", "confidence"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "playbook_answers" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text().catch(() => "");
    console.error("gateway", aiRes.status, txt.slice(0, 300));
    if (aiRes.status === 429) return json({ error: "Rate limited — try again shortly." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    return json({ error: "Could not research playbook" }, 400);
  }

  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  const rawArgs = call?.function?.arguments ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(rawArgs); } catch {
    return json({ suggestions: [], warning: "AI returned unparseable response." });
  }

  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  // Sanitize
  const clean = suggestions
    .filter((s: any) => s && typeof s.id === "string")
    .map((s: any) => ({
      id: String(s.id),
      answer: typeof s.answer === "string" ? s.answer.trim() : "",
      source: typeof s.source === "string" && s.source.trim() ? s.source.trim() : null,
      confidence: Number.isFinite(s.confidence) ? Math.max(0, Math.min(1, Number(s.confidence))) : 0,
    }));

  return json({ suggestions: clean });
});
