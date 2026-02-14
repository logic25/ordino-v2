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

    // Optional: process rules for a specific company, otherwise all
    let companyFilter: string | null = null;
    try {
      const body = await req.json();
      companyFilter = body.company_id || null;
    } catch {
      // No body is fine for cron
    }

    // Fetch all enabled rules
    let rulesQuery = supabase
      .from("automation_rules")
      .select("*")
      .eq("is_enabled", true)
      .order("priority", { ascending: true });

    if (companyFilter) {
      rulesQuery = rulesQuery.eq("company_id", companyFilter);
    }

    const { data: rules, error: rulesErr } = await rulesQuery;
    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No active rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;
    const now = new Date();

    for (const rule of rules) {
      // Fetch overdue invoices for this company
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*, clients(id, name, email, phone), projects(id, name)")
        .eq("company_id", rule.company_id)
        .in("status", ["sent", "overdue"]);

      if (!invoices || invoices.length === 0) continue;

      for (const invoice of invoices) {
        // Check conditions
        const minAmount = rule.conditions?.min_amount;
        if (minAmount && Number(invoice.total_due) < minAmount) continue;

        // Check exclude disputed
        if (rule.conditions?.exclude_disputed) {
          const { count } = await supabase
            .from("invoice_disputes")
            .select("id", { count: "exact", head: true })
            .eq("invoice_id", invoice.id)
            .in("status", ["open", "under_review"]);
          if ((count || 0) > 0) continue;
        }

        // Calculate trigger match
        let triggerMatched = false;
        const daysOverdue = invoice.due_date
          ? Math.max(0, Math.floor((now.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        if (rule.trigger_type === "days_overdue") {
          triggerMatched = daysOverdue >= rule.trigger_value;
        } else if (rule.trigger_type === "days_since_last_contact") {
          const { data: lastContact } = await supabase
            .from("invoice_follow_ups")
            .select("follow_up_date")
            .eq("invoice_id", invoice.id)
            .order("follow_up_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          const daysSinceContact = lastContact
            ? Math.floor((now.getTime() - new Date(lastContact.follow_up_date).getTime()) / (1000 * 60 * 60 * 24))
            : daysOverdue; // fallback to days overdue if no contact
          triggerMatched = daysSinceContact >= rule.trigger_value;
        } else if (rule.trigger_type === "promise_broken") {
          const { count } = await supabase
            .from("payment_promises")
            .select("id", { count: "exact", head: true })
            .eq("invoice_id", invoice.id)
            .eq("status", "broken");
          triggerMatched = (count || 0) > 0;
        }

        if (!triggerMatched) continue;

        // Check cooldown — was this rule fired recently for this invoice?
        const cooldownCutoff = new Date(now.getTime() - rule.cooldown_hours * 60 * 60 * 1000).toISOString();
        const { count: recentCount } = await supabase
          .from("automation_logs")
          .select("id", { count: "exact", head: true })
          .eq("rule_id", rule.id)
          .eq("invoice_id", invoice.id)
          .gte("created_at", cooldownCutoff);

        if ((recentCount || 0) > 0) continue;

        // Check max executions
        if (rule.max_executions) {
          const { count: totalCount } = await supabase
            .from("automation_logs")
            .select("id", { count: "exact", head: true })
            .eq("rule_id", rule.id)
            .eq("invoice_id", invoice.id);
          if ((totalCount || 0) >= rule.max_executions) continue;
        }

        // Execute rule action
        let generatedMessage: string | null = null;
        let actionTaken = "";
        let result = "pending";

        if (rule.action_type === "generate_reminder") {
          // Generate AI message
          const tone = rule.action_config?.tone || "professional";
          const urgencyLevel = daysOverdue >= 90 ? "high" : daysOverdue >= 60 ? "medium" : "low";

          // Fetch company name
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", rule.company_id)
            .single();

          const prompt = `Generate a professional collection email for an architecture/engineering consulting firm.

Invoice: ${invoice.invoice_number}
Amount Due: $${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
Days Overdue: ${daysOverdue}
Client: ${invoice.clients?.name || "Client"}
Project: ${invoice.projects?.name || "N/A"}
Company: ${company?.name || "Our Company"}
Tone: ${tone}
Urgency: ${urgencyLevel}

Requirements:
- Professional but ${tone}
- Include specific invoice details
- Clear call to action
- Under 200 words

Respond in JSON: { "subject": "<subject>", "body": "<body>" }`;

          try {
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

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const content = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                generatedMessage = JSON.stringify(parsed);
              }
            }
          } catch (err) {
            console.error("AI generation failed for rule", rule.id, err);
          }

          actionTaken = `AI reminder generated (${tone} tone) for ${daysOverdue}-day overdue invoice`;
          result = "awaiting_approval";
        } else if (rule.action_type === "escalate") {
          actionTaken = `Escalated: Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue ($${Number(invoice.total_due).toFixed(2)})`;
          result = "escalated";
        } else if (rule.action_type === "notify") {
          actionTaken = `Notification: ${rule.name} triggered for invoice ${invoice.invoice_number}`;
          result = "sent";
        }

        // Log the execution
        await supabase.from("automation_logs").insert({
          company_id: rule.company_id,
          rule_id: rule.id,
          invoice_id: invoice.id,
          client_id: invoice.client_id,
          action_taken: actionTaken,
          result,
          generated_message: generatedMessage,
          escalated_to: rule.action_config?.escalate_to || null,
          metadata: {
            days_overdue: daysOverdue,
            tone: rule.action_config?.tone,
            trigger_type: rule.trigger_type,
            trigger_value: rule.trigger_value,
          },
        });

        totalProcessed++;
      }
    }

    return new Response(JSON.stringify({
      processed: totalProcessed,
      rules_evaluated: rules.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-automation-rules error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
