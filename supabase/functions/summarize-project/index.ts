// summarize-project: generates an AI status summary for a single project and
// (optionally) persists it to project_notes as source='ai_on_demand' or 'ai_weekly'.
// Can be invoked by the frontend (user JWT) OR by the weekly cron (x-cron-secret + body.companyId + body.projectId + body.actorUserId).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface RequestBody {
  projectId: string;
  persist?: boolean;
  source?: "ai_on_demand" | "ai_weekly";
  // For cron only:
  companyId?: string;
  actorUserId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = (await req.json()) as RequestBody;
    if (!body?.projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve cron secret (env or vault)
    let resolvedCronSecret = cronSecret || "";
    if (!resolvedCronSecret) {
      const { data: vaultRow } = await admin
        .schema("vault" as any)
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("name", "cron_secret")
        .maybeSingle();
      resolvedCronSecret = (vaultRow as any)?.decrypted_secret || "";
    }

    // ---- Auth: user JWT OR cron secret ----
    let actorUserId: string | undefined;
    let companyId: string | undefined;
    const callerCronSecret = req.headers.get("x-cron-secret");
    if (resolvedCronSecret && callerCronSecret === resolvedCronSecret) {
      actorUserId = body.actorUserId;
      companyId = body.companyId;
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      actorUserId = user.id;
      const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      companyId = prof?.company_id;
    }

    if (!companyId) throw new Error("Could not resolve company");

    // ---- Load project + context, scoped to company ----
    const { data: project, error: projErr } = await admin
      .from("projects")
      .select(`
        id, name, project_number, status, waiting_on, waiting_since, waiting_note, notes,
        expected_construction_start, estimated_construction_completion,
        properties(address),
        clients!projects_client_id_fkey(name)
      `)
      .eq("id", body.projectId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (projErr) throw projErr;
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recent activities (last 30 days)
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: activities } = await admin
      .from("activities")
      .select("type, description, created_at")
      .eq("company_id", companyId)
      .eq("project_id", project.id)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(25);

    // Services for the project
    const { data: services } = await admin
      .from("services")
      .select("name, status, total_amount, billed_amount")
      .eq("project_id", project.id)
      .limit(20);

    // Recent project_notes (manual) so AI knows what was already said
    const { data: recentNotes } = await admin
      .from("project_notes")
      .select("body, source, created_at, service_id, services(name)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Recent tagged emails for this project (last 30 days). Snippet for all,
    // trimmed body_text for the 3 most recent so AI can reference what was actually said.
    const { data: emailTags } = await admin
      .from("email_project_tags")
      .select("category, tagged_at, emails(subject, from_name, from_email, date, snippet, body_text)")
      .eq("project_id", project.id)
      .gte("tagged_at", since30)
      .order("tagged_at", { ascending: false })
      .limit(10);

    const stripQuotedReplies = (s: string): string => {
      if (!s) return "";
      // Cut at common reply markers
      const markers = [
        /\n[ \t]*On .{1,120} wrote:/i,
        /\n[ \t]*-----Original Message-----/i,
        /\n[ \t]*From: .+\n.*Sent: /i,
        /\n[ \t]*From: .+\n.*Date: /i,
      ];
      let out = s;
      for (const m of markers) {
        const idx = out.search(m);
        if (idx > 0) out = out.slice(0, idx);
      }
      // Drop quoted lines starting with ">"
      out = out
        .split("\n")
        .filter((ln) => !/^\s*>/.test(ln))
        .join("\n");
      return out.trim();
    };

    const recentEmails = (emailTags || []).map((t: any, idx: number) => {
      const e = t.emails || {};
      const base = {
        from: [e.from_name, e.from_email].filter(Boolean).join(" "),
        date: e.date,
        subject: e.subject,
        category: t.category,
        snippet: e.snippet || null,
      };
      // Trimmed body only for the 3 most recent
      if (idx < 3 && e.body_text) {
        const cleaned = stripQuotedReplies(e.body_text);
        return { ...base, body: cleaned.length > 600 ? cleaned.slice(0, 600) + "…" : cleaned };
      }
      return base;
    });

    // Project readiness — open checklist items (what we're still waiting on)
    const { data: checklist } = await admin
      .from("project_checklist_items")
      .select("label, category, from_whom, status, requested_date")
      .eq("project_id", project.id)
      .order("sort_order");

    const nowMs = Date.now();
    const openChecklist = (checklist || []).filter((c: any) => c.status !== "done");
    const completedCount = (checklist || []).length - openChecklist.length;
    const readiness = {
      total_items: (checklist || []).length,
      completed: completedCount,
      open: openChecklist.length,
      ready_to_file: (checklist || []).length > 0 && openChecklist.length === 0,
      open_items: openChecklist.map((c: any) => ({
        label: c.label,
        category: c.category,
        from_whom: c.from_whom,
        days_waiting: c.requested_date
          ? Math.floor((nowMs - new Date(c.requested_date).getTime()) / 86400000)
          : null,
      })),
    };

    // ---- Build prompt ----
    const ctx = {
      project: {
        name: project.name,
        number: project.project_number,
        status: project.status,
        address: (project as any).properties?.address,
        client: (project as any).clients?.name,
        waiting_on: project.waiting_on,
        waiting_note: project.waiting_note,
        expected_start: project.expected_construction_start,
        estimated_completion: project.estimated_construction_completion,
        legacy_notes: project.notes,
      },
      readiness,
      services: (services || []).map((s: any) => ({
        name: s.name, status: s.status, billed: s.billed_amount, total: s.total_amount,
      })),
      recent_activity: (activities || []).map((a: any) => ({
        type: a.type, description: a.description, at: a.created_at,
      })),
      recent_notes: (recentNotes || []).map((n: any) => ({
        source: n.source,
        service: n.services?.name || null,
        body: n.body,
        at: n.created_at,
      })),
      recent_emails: recentEmails,
    };

    const systemPrompt = `You are an operations analyst for Ordino, a project-management platform for NYC construction filings. Write a CONCISE status summary (4-6 sentences, no bullets, no headers) describing where this project stands RIGHT NOW: readiness (what checklist items are still open and from whom), recent meaningful activity, blockers from emails, and the next concrete action. Be specific — name the open checklist items and who we're waiting on. If readiness.ready_to_file is true, say it's ready to file. Quote or reference what client/agency emails actually said when it explains the current status. Use plain English. Never invent facts not in the JSON.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Project context (JSON):\n${JSON.stringify(ctx, null, 2)}` },
        ],
        temperature: 0.3,
      }),
    });


    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text().catch(() => "");
      console.error("AI gateway error", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiJson = await aiResponse.json();
    const summary: string = aiJson?.choices?.[0]?.message?.content?.trim() || "";
    if (!summary) throw new Error("Empty AI summary");

    let savedId: string | undefined;
    if (body.persist) {
      const { data: inserted, error: insErr } = await admin
        .from("project_notes")
        .insert({
          project_id: project.id,
          company_id: companyId,
          user_id: actorUserId ?? null,
          body: summary,
          source: body.source === "ai_weekly" ? "ai_weekly" : "ai_on_demand",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      savedId = inserted?.id;
    }

    return new Response(JSON.stringify({ success: true, summary, savedId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("summarize-project error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
