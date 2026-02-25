import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Get all active schedules due today or earlier
    const { data: schedules, error: schedErr } = await supabase
      .from("billing_schedules")
      .select("*, projects(id, name, project_number, client_id)")
      .eq("is_active", true)
      .lte("next_bill_date", today);

    if (schedErr) throw schedErr;

    let processed = 0;

    for (const schedule of schedules || []) {
      // Check max occurrences
      if (schedule.max_occurrences && schedule.occurrences_completed >= schedule.max_occurrences) {
        await supabase.from("billing_schedules").update({ is_active: false }).eq("id", schedule.id);
        continue;
      }

      // Check end date
      if (schedule.end_date && schedule.end_date < today) {
        await supabase.from("billing_schedules").update({ is_active: false }).eq("id", schedule.id);
        continue;
      }

      // Create billing request
      const serviceItem = {
        name: schedule.service_name,
        description: schedule.billing_method === "percentage"
          ? `${schedule.billing_value}% recurring`
          : `$${Number(schedule.billing_value).toFixed(2)} recurring`,
        quantity: 1,
        rate: Number(schedule.billing_value),
        amount: Number(schedule.billing_value),
        billing_method: schedule.billing_method,
        billing_value: Number(schedule.billing_value),
      };

      const { data: billingReq, error: brError } = await supabase
        .from("billing_requests")
        .insert({
          company_id: schedule.company_id,
          project_id: schedule.project_id,
          created_by: schedule.created_by,
          services: [serviceItem],
          total_amount: Number(schedule.billing_value),
          status: schedule.auto_approve ? "invoiced" : "pending",
          billed_to_contact_id: schedule.billed_to_contact_id,
        })
        .select()
        .single();

      if (brError) {
        console.error(`Failed to create billing request for schedule ${schedule.id}:`, brError);
        continue;
      }

      // If auto-approve, also create invoice
      if (schedule.auto_approve && billingReq) {
        const { data: invoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            company_id: schedule.company_id,
            invoice_number: "",
            project_id: schedule.project_id,
            client_id: schedule.projects?.client_id || null,
            billing_request_id: billingReq.id,
            line_items: [{ description: serviceItem.name, quantity: 1, rate: serviceItem.rate, amount: serviceItem.amount }],
            subtotal: serviceItem.amount,
            retainer_applied: 0,
            fees: {},
            total_due: serviceItem.amount,
            status: "ready_to_send",
            payment_terms: "Net 30",
            billed_to_contact_id: schedule.billed_to_contact_id,
            created_by: schedule.created_by,
          })
          .select()
          .single();

        if (!invErr && invoice) {
          await supabase.from("billing_requests")
            .update({ status: "invoiced", invoice_id: invoice.id })
            .eq("id", billingReq.id);
        }
      }

      // Calculate next bill date
      const nextDate = new Date(schedule.next_bill_date);
      switch (schedule.frequency) {
        case "weekly": nextDate.setDate(nextDate.getDate() + 7); break;
        case "biweekly": nextDate.setDate(nextDate.getDate() + 14); break;
        case "monthly": nextDate.setMonth(nextDate.getMonth() + 1); break;
        case "quarterly": nextDate.setMonth(nextDate.getMonth() + 3); break;
      }

      await supabase.from("billing_schedules").update({
        last_billed_at: new Date().toISOString(),
        occurrences_completed: (schedule.occurrences_completed || 0) + 1,
        next_bill_date: nextDate.toISOString().split("T")[0],
      }).eq("id", schedule.id);

      processed++;
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
