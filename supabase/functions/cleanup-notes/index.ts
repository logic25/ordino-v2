import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { notes, code_reference, objection_text } = await req.json();
    if (!notes?.trim()) {
      return new Response(JSON.stringify({ error: "notes required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a writing assistant for a NYC DOB expediting firm. Your job is to take rough PM notes about a DOB objection response and polish them into a clear, professional response. The output will either be sent to the project architect for review/action or used directly in a meeting with the DOB plan examiner.

Rules:
- Keep the same meaning and technical substance — do NOT add information the PM didn't include.
- Use professional, confident, and direct tone appropriate for communication with architects and DOB examiners. No filler or fluff.
- Preserve any code references, section numbers, zoning citations, or technical terms exactly as written.
- Structure clearly: if there are multiple points, use a short numbered list. Otherwise use concise paragraphs.
- When the notes reference drawings or submittals, keep those references specific.
- Do NOT add greetings, sign-offs, or subject lines — just the response body.
- If the notes are already well-written, make only minimal improvements.
- The result should be ready to send as-is — no placeholders or brackets for the PM to fill in.`;

    const userPrompt = `DOB Objection${code_reference ? ` (${code_reference})` : ""}: "${objection_text || "N/A"}"

PM's rough notes:
${notes}

Polish these notes into a professional response ready for the architect or examiner:`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const cleaned = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("cleanup-notes error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
