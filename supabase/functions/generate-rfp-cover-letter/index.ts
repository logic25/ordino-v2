import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { rfp, companyInfo, staffCount, certifications } = await req.json();

    const systemPrompt = `You are an expert proposal writer for engineering and architecture consulting firms responding to government RFPs.

Write a professional cover letter for an RFP response. The letter should:
1. Be addressed to the issuing agency
2. Reference the RFP number and title
3. Express interest and qualifications
4. Briefly highlight relevant experience, certifications, and team size
5. Mention M/WBE participation if applicable
6. Include a professional closing

Use a confident but not arrogant tone. Keep it to about 3-4 paragraphs.
Return ONLY the letter text, no JSON wrapping.`;

    const userContent = `Write a cover letter for this RFP response:

RFP Title: ${rfp.title}
RFP Number: ${rfp.rfp_number || "N/A"}
Agency: ${rfp.agency || "N/A"}
Due Date: ${rfp.due_date || "N/A"}
Contract Value: ${rfp.contract_value ? `$${rfp.contract_value.toLocaleString()}` : "N/A"}
M/WBE Goal: ${rfp.mwbe_goal_min ? `${rfp.mwbe_goal_min}%` : "N/A"}
Scope: ${rfp.notes || "N/A"}

Company Info:
Name: ${companyInfo?.legal_name || companyInfo?.name || "Our Firm"}
Address: ${companyInfo?.address || ""}
Phone: ${companyInfo?.phone || ""}
Founded: ${companyInfo?.founded_year || ""}
Staff: ${staffCount || companyInfo?.staff_count || ""}

Certifications: ${certifications?.map((c: any) => c.title).join(", ") || "None listed"}`;

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
            { role: "user", content: userContent },
          ],
          temperature: 0.7,
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
    const letter = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ letter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cover-letter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
