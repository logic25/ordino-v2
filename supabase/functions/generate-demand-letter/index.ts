import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_MODEL = "google/gemini-3-flash-preview";

function money(n: number) {
  return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysOverdue(due: string | null): number {
  if (!due) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 86400000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const { invoice_id, scope } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve caller's company
    const { data: profile } = await supabase.from("profiles").select("id, company_id, first_name, last_name").eq("user_id", user.id).single();
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company for user" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const company_id = profile.company_id;

    // Trigger invoice -> client_id (+ project for property scoping)
    const { data: trigInv, error: trigErr } = await supabase
      .from("invoices")
      .select("id, client_id, project_id")
      .eq("id", invoice_id)
      .eq("company_id", company_id)
      .single();
    if (trigErr || !trigInv) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Past-due invoices for this client (or just this property)
    let invQuery = supabase
      .from("invoices")
      .select(`
        id, invoice_number, status, due_date, created_at, total_due, retainer_applied, line_items,
        project_id,
        projects:projects!invoices_project_id_fkey (id, name, address, proposal_id)
      `)
      .eq("company_id", company_id)
      .eq("client_id", trigInv.client_id)
      .neq("status", "paid")
      .neq("status", "draft");

    if (scope === "property" && trigInv.project_id) {
      invQuery = invQuery.eq("project_id", trigInv.project_id);
    }
    const { data: invoicesRaw } = await invQuery;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = (invoicesRaw || []).filter((inv: any) => {
      if (!inv.due_date) return false;
      const d = new Date(inv.due_date);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });

    if (overdueInvoices.length === 0) {
      return new Response(JSON.stringify({ error: "No past-due invoices found for this client" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull proposals (signed agreements) for those projects
    const proposalIds = Array.from(new Set(
      overdueInvoices.map((i: any) => i.projects?.proposal_id).filter(Boolean)
    ));
    const { data: proposals } = proposalIds.length
      ? await supabase
          .from("proposals")
          .select("id, proposal_number, client_signed_at, terms_conditions, late_interest_rate_apr, interest_grace_days")
          .in("id", proposalIds)
      : { data: [] as any[] };

    // Client + primary Bill To contact
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email, address, city, state, zip")
      .eq("id", trigInv.client_id!)
      .single();

    const { data: billToContact } = await supabase
      .from("client_contacts")
      .select("id, name, first_name, last_name, email, phone, title")
      .eq("client_id", trigInv.client_id!)
      .eq("company_id", company_id)
      .limit(1)
      .maybeSingle();

    // Company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, email, phone, address, settings")
      .eq("id", company_id)
      .single();

    const settings = (company?.settings || {}) as Record<string, any>;
    const interestEnabled = !!settings.late_interest_enabled;
    const defaultRateApr = Number(settings.default_late_interest_rate_apr || 0);
    const defaultGrace = Number(settings.default_interest_grace_days || 0);
    const effectiveFrom = settings.interest_clause_effective_from ? new Date(settings.interest_clause_effective_from) : null;
    const managingMember = settings.managing_member_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Managing Member";

    // Per-invoice itemization w/ accrued interest
    let grandPrincipal = 0;
    let grandInterest = 0;
    const byProperty = new Map<string, { property: string; rows: any[]; subtotal: number }>();

    for (const inv of overdueInvoices) {
      const proj = inv.projects;
      const proposal = proposals?.find((p: any) => p.id === proj?.proposal_id);
      const propKey = proj?.address || proj?.name || "—";

      // Short scope: first line item description or fallback
      const li = Array.isArray(inv.line_items) ? inv.line_items : [];
      const scopeLabel = li[0]?.description || li[0]?.name || proj?.name || "Services";

      const principal = Number(inv.total_due || 0);
      grandPrincipal += principal;

      // Accrued interest
      let accrued = 0;
      let appliedRate = 0;
      if (interestEnabled && inv.due_date) {
        const signedAt = proposal?.client_signed_at ? new Date(proposal.client_signed_at) : null;
        const cleared = !effectiveFrom || (signedAt && signedAt >= effectiveFrom);
        if (cleared) {
          appliedRate = Number(proposal?.late_interest_rate_apr ?? defaultRateApr);
          const grace = Number(proposal?.interest_grace_days ?? defaultGrace);
          const start = new Date(inv.due_date);
          start.setDate(start.getDate() + grace);
          const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
          accrued = appliedRate > 0 ? Math.round(((principal * (appliedRate / 100) * (days / 365)) * 100)) / 100 : 0;
        }
      }
      grandInterest += accrued;

      if (!byProperty.has(propKey)) byProperty.set(propKey, { property: propKey, rows: [], subtotal: 0 });
      const bucket = byProperty.get(propKey)!;
      bucket.rows.push({
        invoice_number: inv.invoice_number,
        scope_label: scopeLabel,
        principal,
        accrued_interest: accrued,
        rate_apr: appliedRate,
        days_overdue: daysOverdue(inv.due_date),
        proposal_number: proposal?.proposal_number || null,
        proposal_signed_at: proposal?.client_signed_at || null,
      });
      bucket.subtotal += principal + accrued;
    }

    const propertyGroups = Array.from(byProperty.values());

    // Concatenate distinct terms text for clause quoting (capped)
    const termsBlob = (proposals || [])
      .map((p: any) => p.terms_conditions)
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, 12000);

    const recipientName = billToContact?.name
      || (billToContact?.first_name ? `${billToContact.first_name} ${billToContact.last_name || ""}`.trim() : null)
      || client?.name
      || "Client";
    const recipientAddress = client?.address
      ? [client.address, [client.city, client.state, client.zip].filter(Boolean).join(", ")].filter(Boolean).join("\n")
      : "";

    const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const proposalRefs = (proposals || [])
      .filter((p: any) => p.proposal_number)
      .map((p: any) => ({
        proposal_number: p.proposal_number,
        signed_at: p.client_signed_at,
      }));

    const grandTotal = grandPrincipal + grandInterest;

    // Build prompt
    const systemPrompt = `You are a careful collections-letter writer for a NYC construction expediting firm. Produce a formal demand letter in the EXACT style of the example below — same headings, same paragraph flow, same legal tone — but using ONLY the factual data provided in the user message. Hard rules:
- NEVER invent invoice numbers, dates, dollar amounts, proposal numbers, or contractual language.
- Quote contract clauses ONLY if they appear verbatim (or near-verbatim) in the provided TERMS_TEXT. If a clause is not present, omit it — do not paraphrase or fabricate.
- Include the DOB sentence ("All services were performed and filed with the NYC Department of Buildings…") only if jobs were filed; otherwise omit.
- ALWAYS state the demand is for payment within ten (10) business days of the letter date.
- If contractual interest is provided (rate > 0), state the contractual rate. If not, fall back to "statutory interest at 9% per annum" only in the post-judgment-remedies paragraph.
- Return STRICT JSON: { "subject": string, "body": string }. The body uses plain line breaks (\\n\\n between paragraphs); no markdown.

STYLE EXAMPLE (format only, do NOT copy facts):
"""
[Company letterhead lines]

[Date]
VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED

[Recipient name]
[Recipient address]

Re: Past-Due Balance — [Property/Properties] (Invoices #..., #...)

Dear [Mr./Ms. LastName],

This letter is a formal demand for payment of the outstanding balance owed to [Company] under our signed agreement(s) dated [Date] (Proposal #...).

As of [statement date], the total past-due balance is $X,XXX.XX, itemized as follows:

[Property Address] — $X,XXX.XX
INV #... ([scope]) — $X,XXX.XX
...

All services were performed and filed with the NYC Department of Buildings as documented in the corresponding DOB job records. Each invoice was due Net 30 and remains unpaid.

[Optional: quoted clause paragraph if present in TERMS_TEXT]

Demand is hereby made for payment of $X,XXX.XX within ten (10) business days of the date of this letter.

[Consequences paragraph — lawsuit, judgment lien, statutory/contractual interest, court costs, attorney's fees]

We would prefer to resolve this amicably. Please remit payment to the address above or contact our office immediately to discuss resolution.

Sincerely,
[Managing Member Name]
Managing Member, [Company]
"""`;

    const userPayload = {
      LETTER_DATE: todayStr,
      COMPANY: {
        name: company?.name || "Company",
        address: company?.address || settings.company_address || "",
        phone: company?.phone || settings.company_phone || "",
        email: company?.email || settings.company_email || "",
        managing_member: managingMember,
      },
      RECIPIENT: {
        name: recipientName,
        address: recipientAddress,
      },
      CLIENT_NAME: client?.name || recipientName,
      PROPOSALS: proposalRefs,
      INTEREST: {
        contractual_rate_present: interestEnabled && grandInterest > 0,
        rate_apr: interestEnabled && grandInterest > 0 ? (proposalRefs.length ? "see proposal rate" : defaultRateApr) : null,
      },
      PROPERTY_GROUPS: propertyGroups.map(g => ({
        property: g.property,
        subtotal: g.subtotal,
        invoices: g.rows.map(r => ({
          invoice_number: r.invoice_number,
          scope: r.scope_label,
          amount_due: r.principal,
          accrued_interest: r.accrued_interest,
          days_overdue: r.days_overdue,
        })),
      })),
      GRAND_PRINCIPAL: grandPrincipal,
      GRAND_INTEREST: grandInterest,
      GRAND_TOTAL: grandTotal,
      DOB_JOBS_FILED: true, // expediting firm — default true
      TERMS_TEXT: termsBlob,
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `DATA:\n${JSON.stringify(userPayload, null, 2)}\n\nWrite the demand letter now. Return STRICT JSON {subject, body}.` },
        ],
        temperature: 0.4,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: `AI error ${aiResp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Log usage best-effort
    try {
      const u = aiData.usage || {};
      const pt = u.prompt_tokens || 0;
      const ct = u.completion_tokens || 0;
      await supabase.from("ai_usage_logs").insert({
        company_id, user_id: user.id, feature: "demand_letter", model: AI_MODEL,
        prompt_tokens: pt, completion_tokens: ct,
        total_tokens: u.total_tokens || (pt + ct),
        estimated_cost_usd: (pt * 0.075 + ct * 0.30) / 1_000_000,
      });
    } catch (e) { console.error("ai_usage_logs insert failed", e); }

    let subject = `Formal Demand for Payment — ${client?.name || "Past-Due Balance"}`;
    let body = "";
    let warning: string | undefined;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      subject = parsed.subject || subject;
      body = parsed.body || "";
    } catch {
      warning = "AI response could not be parsed; using fallback letter.";
      body = `Dear ${recipientName},\n\nThis letter is a formal demand for payment of the outstanding balance of ${money(grandTotal)} owed to ${company?.name || "our firm"} on the following past-due invoices:\n\n${propertyGroups.map(g => `${g.property} — ${money(g.subtotal)}\n${g.rows.map(r => `  INV #${r.invoice_number} (${r.scope_label}) — ${money(r.principal)}`).join("\n")}`).join("\n\n")}\n\nDemand is hereby made for payment of ${money(grandTotal)} within ten (10) business days of the date of this letter.\n\nSincerely,\n${managingMember}\nManaging Member, ${company?.name || ""}`;
    }

    return new Response(JSON.stringify({
      subject,
      body,
      grand_principal: grandPrincipal,
      grand_interest: grandInterest,
      grand_total: grandTotal,
      invoice_ids: overdueInvoices.map((i: any) => i.id),
      property_count: propertyGroups.length,
      invoice_count: overdueInvoices.length,
      interest_enabled: interestEnabled,
      property_groups: propertyGroups,
      recipient: { name: recipientName, address: recipientAddress, email: billToContact?.email || client?.email || null },
      company: {
        name: company?.name,
        address: company?.address || settings.company_address,
        phone: company?.phone || settings.company_phone,
        email: company?.email || settings.company_email,
        managing_member: managingMember,
      },
      letter_date: todayStr,
      warning,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("generate-demand-letter error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
