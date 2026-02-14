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
    const supabase = createClient(supabaseUrl, serviceKey);

    const { client_id, company_id } = await req.json();

    if (!client_id || !company_id) {
      return new Response(JSON.stringify({ error: "client_id and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all invoices for this client
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("id, status, total_due, due_date, paid_at, sent_at, created_at")
      .eq("client_id", client_id)
      .eq("company_id", company_id);

    if (invError) throw invError;

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    let totalPaid = 0;
    let totalDaysToPayment = 0;
    let paidCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let longestLate = 0;
    let lastPaymentDate: string | null = null;
    let totalLifetimeValue = 0;
    let recentInvoices = 0;

    for (const inv of invoices || []) {
      totalLifetimeValue += Number(inv.total_due) || 0;

      const isRecent = inv.created_at && new Date(inv.created_at) >= twelveMonthsAgo;
      if (isRecent) recentInvoices++;

      if (inv.paid_at) {
        const paidDate = new Date(inv.paid_at);
        const sentOrCreated = inv.sent_at ? new Date(inv.sent_at) : new Date(inv.created_at);
        const daysToPayment = Math.max(0, Math.floor((paidDate.getTime() - sentOrCreated.getTime()) / (1000 * 60 * 60 * 24)));

        totalDaysToPayment += daysToPayment;
        paidCount++;

        if (!lastPaymentDate || paidDate > new Date(lastPaymentDate)) {
          lastPaymentDate = inv.paid_at;
        }

        if (inv.due_date) {
          const dueDate = new Date(inv.due_date);
          const daysLate = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLate <= 0) {
            if (isRecent) onTimeCount++;
          } else {
            if (isRecent) lateCount++;
            if (daysLate > longestLate) longestLate = daysLate;
          }
        } else {
          if (isRecent) onTimeCount++;
        }
      }
    }

    const avgDays = paidCount > 0 ? totalDaysToPayment / paidCount : null;
    const totalWithOutcome = onTimeCount + lateCount;
    const reliabilityScore = totalWithOutcome > 0
      ? Math.round((onTimeCount / totalWithOutcome) * 100)
      : null;

    // Check follow-up responsiveness
    const { count: reminderCount } = await supabase
      .from("invoice_follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .in("invoice_id", (invoices || []).map((i: any) => i.id))
      .eq("contact_method", "reminder_email");

    const respondsToReminders = (reminderCount || 0) > 0 && reliabilityScore !== null && reliabilityScore >= 60;

    const analytics = {
      client_id,
      company_id,
      avg_days_to_payment: avgDays,
      payment_reliability_score: reliabilityScore,
      last_12mo_invoices: recentInvoices,
      last_12mo_paid_on_time: onTimeCount,
      last_12mo_late: lateCount,
      longest_days_late: longestLate,
      preferred_contact_method: "email",
      best_contact_time: null,
      responds_to_reminders: respondsToReminders,
      total_lifetime_value: totalLifetimeValue,
      last_payment_date: lastPaymentDate ? lastPaymentDate.split("T")[0] : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("client_payment_analytics")
      .upsert(analytics, { onConflict: "client_id,company_id" })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-client-payments error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
