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

    // Convert PDF to base64 for multimodal AI
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Base64 encode the PDF
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Pdf = btoa(binary);

    const systemPrompt = `You are an expert at analyzing government RFP (Request for Proposal) documents for engineering/architecture consulting firms.

Extract the following information from the RFP document. Return ONLY valid JSON (no markdown, no code blocks) with these fields:
- title: string (the project/RFP title)
- rfp_number: string | null (The RFP identifier — look for "RFP Number", "PIN", "Contract No.", "Contract Number", "Project Code", "Solicitation Number", "Bid Number". Prefer Contract Number if multiple exist. Include the full identifier.)
- agency: string | null (issuing agency name — look for logos, letterheads, headers, or mentions of city/state agencies)
- due_date: string | null (ISO date YYYY-MM-DD)
- contract_value: number | null (dollar value — if not stated, estimate from scope, staff, duration, and typical govt consulting rates of $150-300/hr)
- contract_value_source: "stated" | "estimated"
- mwbe_goal_min: number | null (M/WBE participation goal percentage)
- submission_method: string | null ("email", "portal", "in-person", or "mail")
- scope_summary: string (2-3 sentence summary of the scope of work)
- insurance_requirements: object | null (keys: general_liability, workers_comp, umbrella, professional_liability)
- key_dates: array of {label: string, date: string} (milestones like pre-bid conference, Q&A deadline)
- required_sections: array of strings (sections the RFP asks for in the response)
- estimated_staff_count: number | null
- estimated_duration_months: number | null
- notes: string | null (other important notes or unusual requirements)

CRITICAL: Output ONLY the raw JSON object. No markdown. No code fences. Every key must have proper double quotes.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract structured RFP information from this PDF document as JSON.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64Pdf}`,
                  },
                },
              ],
            },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
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
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed;
    try {
      // Try direct parse first (response_format should give clean JSON)
      parsed = JSON.parse(content);
    } catch {
      try {
        // Try extracting from code block
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try extracting any JSON object
          const m = content.match(/\{[\s\S]*\}/);
          if (m) {
            // Repair common issues
            let jsonStr = m[0];
            jsonStr = jsonStr.replace(/"(\w+):\s/g, '"$1": ');
            jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
            parsed = JSON.parse(jsonStr);
          } else {
            throw new Error("No JSON found");
          }
        }
      } catch {
        console.error("Failed to parse AI response:", content.slice(0, 500));
        parsed = {
          title: null,
          rfp_number: null,
          agency: null,
          notes: "Extraction encountered a parsing error. Please fill in fields manually.",
        };
      }
    }

    return new Response(JSON.stringify({ extracted: parsed }), {
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