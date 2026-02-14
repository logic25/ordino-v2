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

    const { invoice_id, company_id } = await req.json();

    if (!invoice_id || !company_id) {
      return new Response(JSON.stringify({ error: "invoice_id and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice details
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(id, name), projects(id, name)")
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

    // Fetch follow-up history for this invoice
    const { data: followUps } = await supabase
      .from("invoice_follow_ups")
      .select("contact_method, notes, created_at")
      .eq("invoice_id", invoice_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate days overdue
    const daysOverdue = invoice.due_date
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const prompt = `You are a payment risk analyst. Analyze this invoice and predict payment likelihood.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Amount: $${invoice.total_due}
- Days Overdue: ${daysOverdue}
- Status: ${invoice.status}
- Client: ${invoice.clients?.name || "Unknown"}

Client Payment History:
${analytics ? `
- Average Days to Payment: ${analytics.avg_days_to_payment || "No data"}
- Payment Reliability Score: ${analytics.payment_reliability_score || "No data"}/100
- Last 12 Months: ${analytics.last_12mo_paid_on_time || 0} on-time, ${analytics.last_12mo_late || 0} late
- Longest Days Late: ${analytics.longest_days_late || 0}
- Lifetime Value: $${analytics.total_lifetime_value || 0}
- Responds to Reminders: ${analytics.responds_to_reminders ? "Yes" : "No/Unknown"}
` : "No historical payment data available for this client."}

Recent Follow-Ups:
${(followUps || []).map((f: any) => `- ${f.contact_method}: ${f.notes || "No notes"} (${f.created_at})`).join("\n") || "No follow-ups recorded."}

Respond in JSON only:
{
  "risk_score": <0-100, where 0=will pay on time, 100=high risk of non-payment>,
  "predicted_days_late": <estimated additional days until payment>,
  "confidence_level": "<high|medium|low>",
  "factors": {
    "key_factor_1": "<description>",
    "key_factor_2": "<description>"
  }
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
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        risk_score: daysOverdue > 60 ? 70 : daysOverdue > 30 ? 50 : 30,
        predicted_days_late: daysOverdue + 15,
        confidence_level: "low",
        factors: { fallback: "AI response could not be parsed, using heuristic scoring" },
      };
    }

    const riskScore = Math.max(0, Math.min(100, parsed.risk_score || 50));
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + (parsed.predicted_days_late || 0));

    const prediction = {
      invoice_id,
      client_id: invoice.client_id,
      company_id,
      risk_score: riskScore,
      predicted_days_late: parsed.predicted_days_late || null,
      predicted_payment_date: predictedDate.toISOString().split("T")[0],
      confidence_level: parsed.confidence_level || "medium",
      factors: parsed.factors || {},
      model_version: "v1",
    };

    const { data, error } = await supabase
      .from("payment_predictions")
      .insert(prediction)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("predict-payment-risk error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
