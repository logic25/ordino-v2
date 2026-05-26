import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Derive company_id from the authenticated user's profile — do not trust client input
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const company_id = profile?.company_id;
    if (!company_id) {
      return new Response(JSON.stringify({ error: "No company membership" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action } = await req.json().catch(() => ({ action: undefined }));

    // Get open/in-progress projects
    const { data: projects } = await sb
      .from("projects")
      .select("id, name, project_number, status, phase, property_id, properties(address)")
      .eq("company_id", company_id)
      .in("status", ["open", "on_hold"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (!projects?.length) {
      return new Response(JSON.stringify({ projects: [], summary: "No open projects found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const project of projects) {
      // Get checklist items for this project
      const { data: items } = await sb
        .from("project_checklist_items")
        .select("*")
        .eq("project_id", project.id)
        .order("sort_order");

      if (!items?.length) {
        results.push({
          project_id: project.id,
          project_number: project.project_number,
          name: project.name,
          address: (project as any).properties?.address,
          phase: project.phase,
          checklist_count: 0,
          completed: 0,
          missing: 0,
          missing_items: [],
          stale_items: [],
          ready: false,
          no_checklist: true,
        });
        continue;
      }

      const completed = items.filter((i: any) => i.status === "done").length;
      const openItems = items.filter((i: any) => i.status !== "done");
      const now = Date.now();

      const staleItems = openItems
        .filter((i: any) => {
          if (!i.requested_date) return false;
          const daysSince = (now - new Date(i.requested_date).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > 3;
        })
        .map((i: any) => ({
          label: i.label,
          category: i.category,
          from_whom: i.from_whom,
          days_waiting: Math.floor((now - new Date(i.requested_date).getTime()) / (1000 * 60 * 60 * 24)),
        }));

      results.push({
        project_id: project.id,
        project_number: project.project_number,
        name: project.name,
        address: (project as any).properties?.address,
        phase: project.phase,
        checklist_count: items.length,
        completed,
        missing: openItems.length,
        missing_items: openItems.map((i: any) => ({
          label: i.label,
          category: i.category,
          from_whom: i.from_whom,
        })),
        stale_items: staleItems,
        ready: openItems.length === 0,
      });
    }

    // Generate follow-up suggestions for stale items
    const followUps: any[] = [];
    if (action === "generate_followups") {
      for (const proj of results) {
        for (const stale of proj.stale_items || []) {
          followUps.push({
            project_id: proj.project_id,
            project_number: proj.project_number,
            address: proj.address,
            item: stale.label,
            days_waiting: stale.days_waiting,
            from_whom: stale.from_whom,
            suggestion: `${stale.label} has been missing for ${stale.days_waiting} days on ${proj.address || proj.name}. Follow up with ${stale.from_whom || "the responsible party"}.`,
          });
        }
      }
    }

    const readyCount = results.filter((r) => r.ready).length;
    const needsAttention = results.filter((r) => !r.ready && r.checklist_count > 0).length;
    const totalStale = results.reduce((sum, r) => sum + (r.stale_items?.length || 0), 0);

    const summary = `${readyCount} project${readyCount !== 1 ? "s" : ""} ready for filing. ${needsAttention} need${needsAttention !== 1 ? "" : "s"} attention. ${totalStale} item${totalStale !== 1 ? "s" : ""} waiting >3 days.`;

    return new Response(
      JSON.stringify({ projects: results, follow_ups: followUps, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("beacon-readiness-check error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
