import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BEACON_API_URL = Deno.env.get("BEACON_API_URL") || "https://beaconrag.up.railway.app";
const BEACON_API_KEY = Deno.env.get("BEACON_ANALYTICS_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const CONFIDENCE_THRESHOLD = 0.72;

const LLM_SYSTEM_PROMPT = `You are a NYC building code research assistant for licensed expediting professionals. 

STRICT RULES:
- Only answer based on established NYC Building Code, Zoning Resolution, Multiple Dwelling Law, NYC Mechanical Code, NYC Plumbing Code, NYC Fire Code, NYC Energy Conservation Code, and related regulations.
- Always cite the specific code section, article, or rule number (e.g., "BC §1003.4", "ZR §23-631", "MDL §53").
- If you are not certain about a specific code section number, say "verify the exact section number" rather than guessing.
- Never invent or fabricate code sections, rule numbers, or regulatory requirements.
- If you don't know, say "I don't have enough information to answer this definitively — consult the specific code chapter or contact DOB directly."
- Write in plain text. No markdown formatting, no bold, no headers, no bullet points, no emojis.
- Be direct and factual. Write in clear paragraphs.
- When relevant, note which code year applies (2014 vs 2022 NYC Building Code) and whether the answer differs by building code vintage.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { question, project_address, filing_type, user_id, user_name } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Try Beacon RAG first
    let beaconResult: any = null;
    let usedBeacon = false;

    try {
      const beaconPrompt = `Answer this NYC building code research question directly in plain text. No markdown, no bold, no asterisks, no emojis, no headers. Just clear, factual paragraphs citing specific code sections.\n\nQuestion: ${question}\nProperty: ${project_address || "N/A"}\nFiling Type: ${filing_type || "N/A"}`;

      const beaconRes = await fetch(`${BEACON_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: JSON.stringify({
          message: beaconPrompt,
          user_id: user_id || user.id,
          user_name: user_name || "User",
          space_id: "ordino-web",
          project_context: { projectAddress: project_address, filingType: filing_type },
        }),
      });

      if (beaconRes.ok) {
        beaconResult = await beaconRes.json();
      }
    } catch (err) {
      console.log("Beacon RAG call failed, falling back to LLM:", err);
    }

    // Step 2: Evaluate confidence
    const beaconConfidence = beaconResult?.confidence ?? 0;
    const beaconSources = beaconResult?.sources ?? [];
    const hasGoodSources = beaconSources.length >= 2 && beaconSources.some((s: any) => s.score > 0.78);
    const beaconIsGood = beaconConfidence >= CONFIDENCE_THRESHOLD && hasGoodSources;

    if (beaconIsGood && beaconResult) {
      // Beacon had a solid answer — use it
      const cleanResponse = cleanMarkdown(beaconResult.response || "");
      return new Response(JSON.stringify({
        response: cleanResponse,
        confidence: beaconConfidence,
        sources: beaconSources,
        source_type: "beacon_rag",
        cached: beaconResult.cached || false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Fall back to LLM (Lovable AI) for general code knowledge
    if (!LOVABLE_API_KEY) {
      // No LLM key available — return Beacon result anyway (even if low confidence)
      if (beaconResult) {
        const cleanResponse = cleanMarkdown(beaconResult.response || "");
        return new Response(JSON.stringify({
          response: cleanResponse,
          confidence: beaconConfidence,
          sources: beaconSources,
          source_type: "beacon_rag",
          cached: beaconResult.cached || false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "No AI backend available" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Question: ${question}${project_address ? `\nProperty Address: ${project_address}` : ""}${filing_type ? `\nFiling Type: ${filing_type}` : ""}`;

    const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: LLM_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!llmRes.ok) {
      const status = llmRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // If LLM failed but Beacon had something, return Beacon
      if (beaconResult) {
        const cleanResponse = cleanMarkdown(beaconResult.response || "");
        return new Response(JSON.stringify({
          response: cleanResponse,
          confidence: beaconConfidence,
          sources: beaconSources,
          source_type: "beacon_rag",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmData = await llmRes.json();
    const llmContent = llmData.choices?.[0]?.message?.content || "";
    const cleanLlmResponse = cleanMarkdown(llmContent);

    // Merge: if Beacon had partial sources, include them
    const mergedSources = beaconSources.length > 0 ? beaconSources : [];

    return new Response(JSON.stringify({
      response: cleanLlmResponse,
      confidence: null,
      sources: mergedSources,
      source_type: beaconSources.length > 0 ? "hybrid" : "llm",
      cached: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Code research error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function cleanMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/^[-*>]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/⚠️|✅|❌|📌|🔹|🔸|➡️|📧/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
