// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function classifyIntent(question: string): string[] {
  const q = question.toLowerCase();
  const intents: string[] = [];
  if (q.match(/project|job|#?\d{4,}/)) intents.push("projects");
  if (q.match(/proposal|quote|bid/)) intents.push("proposals");
  if (q.match(/invoice|payment|paid|owed|outstanding|balance|collect/)) intents.push("invoices");
  if (q.match(/email|sent|received/)) intents.push("emails");
  if (q.match(/client|customer|who/)) intents.push("clients");
  if (q.match(/calendar|meeting|schedule|appointment/)) intents.push("calendar");
  if (q.match(/action item|task|todo|follow.?up|overdue/)) intents.push("action_items");
  if (q.match(/rfp|request for proposal|opportunity/)) intents.push("rfps");
  if (q.match(/chat|conversation|said|discuss/)) intents.push("chats");
  if (intents.length === 0) intents.push("general");
  return intents;
}

function extractProjectNumbers(question: string): string[] {
  const matches = question.match(/#?(\d{4,})/g);
  return matches ? matches.map((m) => m.replace("#", "")) : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id, display_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, conversationHistory = [] } = await req.json();
    if (!question) throw new Error("question required");

    const intents = classifyIntent(question);
    const projectNumbers = extractProjectNumbers(question);
    const context: Record<string, any> = {};

    // Gather context based on intent
    if (intents.includes("projects") || intents.includes("general")) {
      if (projectNumbers.length > 0) {
        const { data: projects } = await supabaseAdmin
          .from("projects")
          .select("id, job_number, project_name, status, client:clients(name), project_manager, created_at, updated_at")
          .eq("company_id", profile.company_id)
          .or(projectNumbers.map((n) => `job_number.ilike.%${n}%`).join(","));
        context.projects = projects;

        if (projects?.length) {
          const { data: actionItems } = await supabaseAdmin
            .from("project_action_items")
            .select("*")
            .in("project_id", projects.map((p: any) => p.id))
            .order("created_at", { ascending: false })
            .limit(20);
          context.action_items = actionItems;
        }
      } else {
        const { data: projects } = await supabaseAdmin
          .from("projects")
          .select("id, job_number, project_name, status, client:clients(name), project_manager")
          .eq("company_id", profile.company_id)
          .order("updated_at", { ascending: false })
          .limit(10);
        context.recent_projects = projects;
      }
    }

    if (intents.includes("proposals") || intents.includes("general")) {
      const { data: proposals } = await supabaseAdmin
        .from("proposals")
        .select("id, proposal_number, title, status, total_amount, client:clients(name), created_at, valid_until, sent_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(15);
      context.proposals = proposals;
    }

    if (intents.includes("invoices") || intents.includes("general")) {
      const { data: invoices } = await supabaseAdmin
        .from("invoices")
        .select("id, invoice_number, status, total_amount, amount_paid, due_date, client:clients(name), project:projects(job_number, project_name)")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(15);
      context.invoices = invoices;
    }

    if (intents.includes("action_items")) {
      const { data: items } = await supabaseAdmin
        .from("project_action_items")
        .select("*, project:projects(job_number, project_name)")
        .eq("company_id", profile.company_id)
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(20);
      context.open_action_items = items;
    }

    if (intents.includes("calendar")) {
      const now = new Date().toISOString();
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabaseAdmin
        .from("calendar_events")
        .select("*")
        .eq("user_id", profile.id)
        .gte("start_time", now)
        .lte("start_time", weekFromNow)
        .order("start_time", { ascending: true })
        .limit(20);
      context.upcoming_events = events;
    }

    if (intents.includes("clients")) {
      const { data: clients } = await supabaseAdmin
        .from("clients")
        .select("id, name, client_type, email, phone")
        .eq("company_id", profile.company_id)
        .order("updated_at", { ascending: false })
        .limit(20);
      context.clients = clients;
    }

    if (intents.includes("rfps")) {
      const { data: rfps } = await supabaseAdmin
        .from("rfps")
        .select("id, title, agency, status, due_date, contract_value")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(10);
      context.rfps = rfps;
    }

    if (intents.includes("emails")) {
      const { data: emails } = await supabaseAdmin
        .from("emails")
        .select("id, subject, from_address, to_address, snippet, received_at")
        .eq("user_id", profile.id)
        .order("received_at", { ascending: false })
        .limit(10);
      context.recent_emails = emails;
    }

    // Build AI prompt
    const systemPrompt = `You are Ordino, an AI assistant for a construction consulting and engineering firm. You have access to live company data from the Ordino system.

The current user is ${profile.display_name || "a team member"}.
Today is ${new Date().toISOString().split("T")[0]}.

RULES:
- Be concise and direct.
- When referencing records, include the number/ID so the user can find it.
- Use these link formats for clickable references:
  - Projects: [Job #XXXX](/projects/PROJECT_UUID)
  - Proposals: [Proposal #XX](/proposals?id=PROPOSAL_UUID)
  - Invoices: [Invoice #XX](/invoices?id=INVOICE_UUID)
  - Clients: [Client Name](/clients/CLIENT_UUID)
- If you don't have enough data, say so.
- Prioritize by urgency (overdue first).
- Format currency as $X,XXX.XX.

Data from Ordino:
${JSON.stringify(context, null, 2)}`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: question });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "I wasn't able to process that. Could you rephrase?";

    // Save conversation
    await supabaseAdmin.from("ordino_assistant_conversations").insert([
      { user_id: user.id, company_id: profile.company_id, role: "user", content: question, context_type: intents[0] },
      { user_id: user.id, company_id: profile.company_id, role: "assistant", content: answer, context_type: intents[0] },
    ]);

    return new Response(JSON.stringify({
      answer,
      intents,
      context_summary: Object.keys(context).map((k) => `${k}: ${Array.isArray(context[k]) ? context[k].length : 1} records`),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ask-ordino error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
