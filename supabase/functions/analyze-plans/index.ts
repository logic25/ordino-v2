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
    const { file_urls } = await req.json();

    if (!file_urls || !Array.isArray(file_urls) || file_urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No file URLs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build content parts: text prompt + image URLs for vision
    const contentParts: any[] = [
      {
        type: "text",
        text: `You are a construction expediting specialist in New York City. Analyze these architectural/construction plan documents and produce a concise job description suitable for a NYC Department of Buildings (DOB) Project Information Sheet (PIS).

The job description should include:
- Type of work (e.g., general construction, plumbing, alteration, new building)
- Approximate scope of work
- Floors/areas affected
- Key construction activities
- Any notable features visible in the plans

Keep the description professional, concise (2-4 sentences), and suitable for official DOB documentation. Do not include assumptions — only describe what you can see in the plans.`,
      },
    ];

    // Add each file as an image URL for vision analysis
    for (const url of file_urls) {
      contentParts.push({
        type: "image_url",
        image_url: { url },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const jobDescription = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ job_description: jobDescription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-plans error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
