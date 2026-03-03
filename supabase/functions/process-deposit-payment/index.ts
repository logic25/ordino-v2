import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposal_token, payment_method, amount } = await req.json();

    if (!proposal_token || !payment_method || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: proposal_token, payment_method, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Validate proposal
    const { data: proposal, error: propErr } = await supabase
      .from("proposals")
      .select("id, company_id, client_id, client_name, client_email, proposal_number, converted_project_id, status, deposit_paid_at, total_amount, deposit_percentage, deposit_required")
      .eq("public_token", proposal_token)
      .single();

    if (propErr || !proposal) {
      return new Response(
        JSON.stringify({ error: "Proposal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (proposal.status !== "executed") {
      return new Response(
        JSON.stringify({ error: "Proposal must be executed before accepting payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (proposal.deposit_paid_at) {
      return new Response(
        JSON.stringify({ error: "Deposit has already been paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = proposal.converted_project_id;
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "No project linked to this proposal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = proposal.company_id;
    const clientId = proposal.client_id;
    const depositAmount = Number(amount);

    // 2. Create client_retainers record
    const { data: retainer, error: retErr } = await supabase
      .from("client_retainers")
      .insert({
        company_id: companyId,
        client_id: clientId,
        original_amount: depositAmount,
        current_balance: depositAmount,
        notes: `Deposit from Proposal #${proposal.proposal_number}`,
      })
      .select("id")
      .single();

    if (retErr) {
      console.error("Failed to create retainer:", retErr);
      return new Response(
        JSON.stringify({ error: "Failed to create deposit record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create retainer_transactions record
    await supabase.from("retainer_transactions").insert({
      company_id: companyId,
      retainer_id: retainer.id,
      type: "deposit",
      amount: depositAmount,
      balance_after: depositAmount,
      description: `Deposit payment — Proposal #${proposal.proposal_number}`,
    });

    // 4. Create a paid invoice
    const paymentMethodLabel =
      payment_method === "card" ? "Credit Card" :
      payment_method === "ach" ? "ACH Transfer" : "Check";

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        company_id: companyId,
        project_id: projectId,
        client_id: clientId,
        status: "paid",
        subtotal: depositAmount,
        total_due: 0,
        payment_amount: depositAmount,
        payment_method: paymentMethodLabel,
        paid_at: new Date().toISOString(),
        line_items: [
          {
            description: `Deposit — Proposal #${proposal.proposal_number}`,
            quantity: 1,
            rate: depositAmount,
            amount: depositAmount,
          },
        ],
        notes: `Deposit payment received via ${paymentMethodLabel} on client proposal page.`,
        retainer_id: retainer.id,
      })
      .select("id, invoice_number, created_at")
      .single();

    if (invErr) {
      console.error("Failed to create invoice:", invErr);
      return new Response(
        JSON.stringify({ error: "Failed to create deposit invoice" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update proposal deposit_paid_at
    await supabase
      .from("proposals")
      .update({ deposit_paid_at: new Date().toISOString() })
      .eq("id", proposal.id);

    // 6. Fetch project info for receipt
    const { data: project } = await supabase
      .from("projects")
      .select("name, project_number")
      .eq("id", projectId)
      .single();

    // 7. Fetch company info for receipt
    const { data: companyData } = await supabase
      .from("companies")
      .select("name, address, phone, email, settings")
      .eq("id", companyId)
      .single();

    const settings = (companyData?.settings || {}) as Record<string, string>;

    return new Response(
      JSON.stringify({
        success: true,
        receipt: {
          invoice_number: invoice.invoice_number,
          invoice_id: invoice.id,
          date: invoice.created_at,
          amount: depositAmount,
          payment_method: paymentMethodLabel,
          proposal_number: proposal.proposal_number,
          client_name: proposal.client_name,
          client_email: proposal.client_email,
          project_name: project?.name || "",
          project_number: project?.project_number || "",
          company_name: companyData?.name || "",
          company_address: settings.company_address || companyData?.address || "",
          company_phone: settings.company_phone || companyData?.phone || "",
          company_email: settings.company_email || companyData?.email || "",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
