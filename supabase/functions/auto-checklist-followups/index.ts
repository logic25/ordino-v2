import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all companies with their settings
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id, name, settings");
    if (compErr) throw compErr;

    let totalDraftsGenerated = 0;

    for (const company of companies || []) {
      const settings = (company.settings || {}) as Record<string, unknown>;
      const thresholdDays = (settings.checklist_auto_followup_days as number) || 7;
      const cooldownHours = (settings.checklist_auto_followup_cooldown_hours as number) || 72;

      // Find projects with outstanding checklist items exceeding threshold
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

      const { data: overdueItems, error: itemsErr } = await supabase
        .from("project_checklist_items")
        .select("id, project_id, label, category, from_whom, requested_date, status")
        .eq("company_id", company.id)
        .eq("status", "open")
        .lt("requested_date", cutoffDate.toISOString());

      if (itemsErr) {
        console.error(`Error fetching items for company ${company.id}:`, itemsErr);
        continue;
      }
      if (!overdueItems || overdueItems.length === 0) continue;

      // Group by project
      const projectMap = new Map<string, typeof overdueItems>();
      for (const item of overdueItems) {
        const list = projectMap.get(item.project_id) || [];
        list.push(item);
        projectMap.set(item.project_id, list);
      }

      for (const [projectId, items] of projectMap) {
        // Check cooldown — skip if draft generated within cooldown period
        const cooldownCutoff = new Date();
        cooldownCutoff.setHours(cooldownCutoff.getHours() - cooldownHours);

        const { data: recentDrafts } = await supabase
          .from("checklist_followup_drafts")
          .select("id")
          .eq("project_id", projectId)
          .gte("created_at", cooldownCutoff.toISOString())
          .limit(1);

        if (recentDrafts && recentDrafts.length > 0) continue;

        // Fetch project details
        const { data: project } = await supabase
          .from("projects")
          .select("id, name, building_owner_name, assigned_pm_id, client_id, property_id, proposals!projects_proposal_id_fkey(title)")
          .eq("id", projectId)
          .single();

        if (!project) continue;

        // Fetch property address
        let propertyAddress = "";
        if (project.property_id) {
          const { data: prop } = await supabase
            .from("properties")
            .select("address")
            .eq("id", project.property_id)
            .single();
          propertyAddress = prop?.address || "";
        }

        // Fetch primary contact email
        let contactEmail = "";
        let ownerName = (project as any).building_owner_name || "";
        if (project.client_id) {
          const { data: contact } = await supabase
            .from("client_contacts")
            .select("name, email")
            .eq("client_id", project.client_id)
            .eq("is_primary", true)
            .maybeSingle();
          if (contact) {
            contactEmail = contact.email || "";
            if (!ownerName) ownerName = contact.name || "";
          }
        }

        // Fetch completed items for context
        const { data: completedItems } = await supabase
          .from("project_checklist_items")
          .select("id, label, category, from_whom, completed_at")
          .eq("project_id", projectId)
          .eq("status", "done");

        const projectName = project.name || (project as any).proposals?.title || "Untitled Project";
        const firmName = company.name || "our firm";

        // Build items with days waiting
        const now = new Date();
        const enrichedItems = items.map((i: any) => ({
          ...i,
          daysWaiting: i.requested_date
            ? Math.floor((now.getTime() - new Date(i.requested_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        }));

        const completedForPrompt = (completedItems || []).map((i: any) => ({
          label: i.label,
          completedAt: i.completed_at ? new Date(i.completed_at).toLocaleDateString() : "recently",
        }));

        // Build prompts (same as draft-checklist-followup)
        const itemLines = enrichedItems
          .map((i: any, idx: number) =>
            `${idx + 1}. "${i.label}" — waiting on: ${i.from_whom || "unknown"}, ${i.daysWaiting} days outstanding (category: ${i.category})`
          )
          .join("\n");

        const completedLines =
          completedForPrompt.length > 0
            ? completedForPrompt.map((i: any, idx: number) => `${idx + 1}. "${i.label}" — received ${i.completedAt}`).join("\n")
            : "None yet";

        const systemPrompt = `You are a professional project coordinator at ${firmName}, an architecture/engineering firm that handles NYC Department of Buildings filings.
Write a polite but firm follow-up email requesting the outstanding items listed below.
The email should:
- Open with a professional greeting using the recipient's name if available
- Reference the project name and property address
- Briefly acknowledge items already received to show progress
- List each outstanding item clearly with how long it has been waiting
- Explain that these items are blocking the filing/project progress
- Close with a clear call-to-action and timeline (request response within 3 business days)
- Keep the tone professional but warm — these are valued clients
- Do NOT include a subject line — just the email body
- Use plain text, no HTML`;

        const userPrompt = `Draft a follow-up email for these outstanding checklist items:

Firm: ${firmName}
Project: ${projectName}
Property: ${propertyAddress || "N/A"}
Recipient: ${ownerName || "the responsible party"}
Contact email: ${contactEmail || "N/A"}

Already received:
${completedLines}

Outstanding items:
${itemLines}`;

        // Call AI gateway
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            stream: false,
          }),
        });

        if (!response.ok) {
          console.error(`AI gateway error for project ${projectId}:`, response.status);
          continue;
        }

        const data = await response.json();
        const draft = data.choices?.[0]?.message?.content || "";

        if (!draft) continue;

        // Insert draft
        const { error: insertErr } = await supabase
          .from("checklist_followup_drafts")
          .insert({
            company_id: company.id,
            project_id: projectId,
            draft_body: draft,
            prompt_system: systemPrompt,
            prompt_user: userPrompt,
            status: "pending_approval",
            triggered_by: "auto",
            trigger_threshold_days: thresholdDays,
            items_snapshot: {
              outstanding: enrichedItems,
              completed: completedForPrompt,
            },
          });

        if (insertErr) {
          console.error(`Error inserting draft for project ${projectId}:`, insertErr);
        } else {
          totalDraftsGenerated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ drafts_generated: totalDraftsGenerated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auto-checklist-followups error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
