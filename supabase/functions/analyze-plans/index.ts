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
