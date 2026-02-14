import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { storagePath } = await req.json();
    if (!storagePath) throw new Error("storagePath is required");

    // Download the file from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("rfp-documents")
      .download(storagePath);
    if (dlError) throw new Error(`Download failed: ${dlError.message}`);

    // Convert to text (for PDFs we extract what we can)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Try to extract text from PDF
    let extractedText = "";
    const textDecoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = textDecoder.decode(bytes);
    
    // Extract readable strings from PDF content
    const textMatches = rawText.match(/\(([^)]+)\)/g);
    if (textMatches) {
      extractedText = textMatches
        .map((m) => m.slice(1, -1))
        .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t))
        .join(" ");
    }
    
    // Also try stream content
    const streamMatches = rawText.match(/BT[\s\S]*?ET/g);
    if (streamMatches) {
      const streamText = streamMatches
        .join(" ")
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ");
      if (streamText.length > extractedText.length) {
        extractedText = streamText;
      }
    }

    // Fallback: just use printable characters
    if (extractedText.length < 100) {
      extractedText = rawText
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 15000);
    }

    // Truncate to reasonable size for AI
    extractedText = extractedText.slice(0, 12000);

    const systemPrompt = `You are an expert at analyzing government RFP (Request for Proposal) documents for engineering/architecture consulting firms.

Extract the following information from the RFP text. Return ONLY a JSON object with these fields:
- title: string (the project/RFP title)
- rfp_number: string | null (RFP or PIN number)
- agency: string | null (issuing agency name)
- due_date: string | null (ISO date format YYYY-MM-DD if found)
- contract_value: number | null (estimated contract value in dollars - if not explicitly stated, estimate based on the scope of work, required personnel, duration, and typical government consulting rates for this type of work. Consider: number of staff needed, project duration, complexity level, and typical hourly rates of $150-300/hr for engineering/architecture consulting)
- contract_value_source: string (either "stated" if the value was explicitly in the document, or "estimated" if you inferred it)
- mwbe_goal_min: number | null (M/WBE participation goal percentage)
- submission_method: string | null (one of: "email", "portal", "in-person", "mail")
- scope_summary: string (2-3 sentence summary of the scope of work)
- insurance_requirements: object | null (keys like general_liability, workers_comp, umbrella, professional_liability with coverage amount strings)
- key_dates: array of {label: string, date: string} (important milestones like pre-bid conference, Q&A deadline)
- required_sections: array of strings (what sections the RFP asks for in the response, e.g. "Organization Chart", "Key Personnel", "Similar Projects")
- estimated_staff_count: number | null (how many personnel are needed based on scope)
- estimated_duration_months: number | null (project duration in months)
- notes: string | null (any other important notes or unusual requirements)

If information is not found, use null. Be precise with dates and numbers. For contract_value, always try to provide an estimate even if not stated - use the scope details and industry knowledge.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analyze this RFP document and extract the structured information:\n\n${extractedText}`,
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (may be wrapped in markdown code block)
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned unparseable response");
    }

    return new Response(JSON.stringify({ extracted: parsed, textLength: extractedText.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-rfp error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
