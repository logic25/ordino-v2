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
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch proposal with related data
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select(`
        *,
        properties (address, borough),
        assigned_pm:profiles!proposals_assigned_pm_id_fkey (first_name, last_name)
      `)
      .eq("id", proposal_id)
      .single();

    if (pErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company info for sender context
    const { data: company } = await supabase
      .from("companies")
      .select("name, settings")
      .eq("id", proposal.company_id)
      .single();

    const companyName = company?.name || "our firm";
    const companyEmail = (company?.settings as any)?.company_email || "";
    const companyPhone = (company?.settings as any)?.company_phone || "";

    // Calculate timing context
    const daysSinceSent = proposal.sent_at
      ? Math.floor((Date.now() - new Date(proposal.sent_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const daysSinceViewed = proposal.viewed_at
      ? Math.floor((Date.now() - new Date(proposal.viewed_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const followUpCount = proposal.follow_up_count || 0;
    const totalAmount = proposal.total_amount || proposal.subtotal || 0;
    const clientName = proposal.client_name || "there";
    const pmName = proposal.assigned_pm
      ? `${proposal.assigned_pm.first_name} ${proposal.assigned_pm.last_name}`
      : "the team";
    const propertyAddress = proposal.properties?.address || "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a professional business development assistant for ${companyName}, a consulting/expediting firm. Generate a follow-up email for a proposal that was sent to a client. The email should be professional, warm, and action-oriented. Keep it concise (3-5 short paragraphs max). Do NOT use markdown formatting. Write plain text that reads naturally as an email.

Return your response as a JSON object with two fields:
- "subject": the email subject line
- "body": the email body text (plain text, use \\n for line breaks)`;

    const contextLines = [
      `Proposal: "${proposal.title}"`,
      `Client: ${clientName}`,
      propertyAddress ? `Property: ${propertyAddress}` : null,
      `Total amount: $${Number(totalAmount).toLocaleString()}`,
      `Days since sent: ${daysSinceSent}`,
      daysSinceViewed !== null ? `Client viewed it ${daysSinceViewed} day(s) ago` : "Client has NOT opened the proposal yet",
      `Previous follow-ups: ${followUpCount}`,
      `Sender name: ${pmName}`,
      `Company: ${companyName}`,
      companyPhone ? `Company phone: ${companyPhone}` : null,
      companyEmail ? `Company email: ${companyEmail}` : null,
    ].filter(Boolean).join("\n");

    const userPrompt = `Generate a follow-up email for this proposal:\n\n${contextLines}\n\nTone guidance:\n${
      followUpCount === 0
        ? "First follow-up: friendly check-in, make sure they received it"
        : daysSinceViewed !== null
        ? "They viewed it: acknowledge they had a chance to review, ask if they have questions"
        : followUpCount >= 2
        ? "Multiple follow-ups: be more direct, mention timeline/availability"
        : "Standard follow-up: professional nudge"
    }${Number(totalAmount) > 15000 ? "\nThis is a high-value proposal — emphasize timeline and availability." : ""}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [
          {
            type: "function",
            function: {
              name: "draft_email",
              description: "Return the drafted follow-up email",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email body as plain text" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "draft_email" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
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
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();

    // Extract from tool call response
    let subject = "";
    let body = "";
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      subject = args.subject || "";
      body = args.body || "";
    }

    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "AI returned empty draft" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert plain text body to simple HTML
    const htmlBody = body.split("\n").map((line: string) =>
      line.trim() ? `<p>${line}</p>` : "<br>"
    ).join("");

    // Log AI usage
    await supabase.from("ai_usage_logs").insert({
      company_id: proposal.company_id,
      feature: "proposal_followup_draft",
      model: "google/gemini-3-flash-preview",
      metadata: { proposal_id, follow_up_count: followUpCount },
    });

    return new Response(
      JSON.stringify({
        subject,
        html_body: htmlBody,
        client_email: proposal.client_email || "",
        client_name: clientName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("draft-proposal-followup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
