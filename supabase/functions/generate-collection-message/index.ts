import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { invoice_id, company_id, tone, urgency, offer_payment_plan } = await req.json();

    if (!invoice_id || !company_id) {
      return new Response(JSON.stringify({ error: "invoice_id and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice with relations
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(id, name, email, phone), projects(id, name)")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client analytics
    const { data: analytics } = await supabase
      .from("client_payment_analytics")
      .select("*")
      .eq("client_id", invoice.client_id)
      .eq("company_id", company_id)
      .maybeSingle();

    // Fetch company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, phone, email")
      .eq("id", company_id)
      .single();

    // Fetch follow-up count
    const { count: reminderCount } = await supabase
      .from("invoice_follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice_id)
      .eq("contact_method", "reminder_email");

    const daysOverdue = invoice.due_date
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const selectedTone = tone || (daysOverdue > 60 ? "urgent" : daysOverdue > 30 ? "firm" : "friendly");
    const selectedUrgency = urgency || (daysOverdue > 60 ? "high" : daysOverdue > 30 ? "medium" : "low");

    const prompt = `Generate a professional collection email for an architecture/engineering consulting firm.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Amount Due: $${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
- Days Overdue: ${daysOverdue}
- Project: ${invoice.projects?.name || "N/A"}
- Client: ${invoice.clients?.name || "Client"}

Client Context:
- Payment History: ${analytics ? `${analytics.avg_days_to_payment || "N/A"} avg days to pay` : "No history"}
- Lifetime Value: $${analytics?.total_lifetime_value || 0}
- Previous Reminders Sent: ${reminderCount || 0}
- Responds to Reminders: ${analytics?.responds_to_reminders ? "Yes" : "Unknown"}

Company: ${company?.name || "Our Company"}

Tone: ${selectedTone} (friendly/firm/urgent)
Urgency Level: ${selectedUrgency}
${offer_payment_plan ? "Include an offer to set up a payment plan." : ""}

Requirements:
- Professional but ${selectedTone}
- Acknowledge the business relationship
- Include specific invoice details
- Clear call to action
- Keep it concise (under 200 words)

Respond in JSON only:
{
  "subject": "<email subject line>",
  "body": "<email body text>"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
        body: `Dear ${invoice.clients?.name || "Client"},\n\nThis is a reminder that invoice ${invoice.invoice_number} for $${Number(invoice.total_due).toFixed(2)} is ${daysOverdue} days past due. Please remit payment at your earliest convenience.\n\nThank you,\n${company?.name || "Our Team"}`,
      };
    }

    return new Response(JSON.stringify({
      subject: parsed.subject,
      body: parsed.body,
      tone: selectedTone,
      urgency: selectedUrgency,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-collection-message error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
