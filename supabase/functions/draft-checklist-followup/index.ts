import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { items, projectName, propertyAddress, ownerName, contactEmail } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No outstanding items provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a structured item list for the prompt
    const itemLines = items.map(
      (i: any, idx: number) =>
        `${idx + 1}. "${i.label}" — waiting on: ${i.from_whom || "unknown"}, ${i.daysWaiting} days outstanding (category: ${i.category})`
    ).join("\n");

    const systemPrompt = `You are a professional project coordinator at an architecture/engineering firm that handles NYC Department of Buildings filings.
Write a polite but firm follow-up email requesting the outstanding items listed below.
The email should:
- Open with a professional greeting using the recipient's name if available
- Reference the project name and property address
- List each outstanding item clearly with how long it's been waiting
- Explain that these items are blocking the filing/project progress
- Close with a clear call-to-action and timeline (request response within 3 business days)
- Keep the tone professional but warm — these are valued clients
- Do NOT include a subject line — just the email body
- Use plain text, no HTML`;

    const userPrompt = `Draft a follow-up email for these outstanding checklist items:

Project: ${projectName || "Untitled Project"}
Property: ${propertyAddress || "N/A"}
Recipient: ${ownerName || "the responsible party"}
Contact email: ${contactEmail || "N/A"}

Outstanding items:
${itemLines}`;

    const response = await fetch(
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
            { role: "user", content: userPrompt },
          ],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const draft = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        draft,
        prompt: { system: systemPrompt, user: userPrompt },
        model: "google/gemini-3-flash-preview",
        itemCount: items.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("draft-checklist-followup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
