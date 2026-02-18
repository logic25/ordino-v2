import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build content parts: text prompt + images/PDFs
    const contentParts: any[] = [
      {
        type: "text",
        text: `You are a NYC DOB expediter assistant. Analyze these construction plans and write a plain-text job description suitable for a DOB Project Information Sheet (PIS).

Rules:
- 1-2 sentences maximum
- No markdown formatting (no bold, headers, bullet points)
- Do NOT classify the work type -- never mention ALT1, ALT2, ALT3, Alteration Type, New Building, Demolition, or any DOB filing category
- Do NOT assume the building use (residential, commercial, etc.) unless it is clearly labeled on the plans
- Describe only the physical scope of work and the areas affected
- Use simple, professional language

Examples:
- "Interior renovation of 2nd-floor commercial space including new partitions, ceiling grid, plumbing rough-in for restroom, and electrical distribution. No change in use, occupancy, or egress."
- "Gut renovation of apartment 4A including removal of non-load-bearing partitions, new kitchen and bathroom layouts, and full MEP upgrades."
- "New storefront installation at ground level with structural opening in bearing wall, new lintel, and associated facade work."`,
      },
    ];

    // For each file URL, download it and convert to base64 data URL
    // This handles PDFs which can't be sent as image_url
    for (const url of file_urls) {
      try {
        const fileRes = await fetch(url);
        if (!fileRes.ok) {
          console.error(`Failed to fetch file: ${fileRes.status} ${url}`);
          continue;
        }
        const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await fileRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Convert to base64
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        // Determine the MIME type for the data URL
        const mimeType = contentType.split(";")[0].trim();
        const dataUrl = `data:${mimeType};base64,${base64}`;

        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      } catch (fetchErr) {
        console.error(`Error fetching file ${url}:`, fetchErr);
      }
    }

    if (contentParts.length <= 1) {
      return new Response(
        JSON.stringify({ error: "Could not process any of the uploaded files" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
