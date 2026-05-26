// Generate an Out-of-Office handoff summary and notify the covering PM.
// Triggered by the frontend when a user activates/updates their OOO state.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    // Verify caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load OOO profile
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, company_id, first_name, last_name, ooo_from, ooo_to, ooo_covering_pm_id, ooo_note")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr || !profile) throw profErr || new Error("Profile not found");
    if (!profile.ooo_covering_pm_id || !profile.ooo_from || !profile.ooo_to) {
      return new Response(JSON.stringify({ skipped: true, reason: "OOO not fully configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all open projects assigned to the OOO PM
    const { data: projects, error: projErr } = await admin
      .from("projects")
      .select(`
        id, name, project_number, waiting_on, waiting_since, waiting_note, updated_at,
        properties(address),
        clients!projects_client_id_fkey(name)
      `)
      .or(`assigned_pm_id.eq.${profile.id},senior_pm_id.eq.${profile.id}`)
      .eq("status", "open")
      .order("updated_at", { ascending: false });

    if (projErr) throw projErr;

    const oooName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your colleague";

    // Bucket projects
    const now = Date.now();
    const buckets = { onYou: [] as any[], waitingClient: [] as any[], other: [] as any[] };
    (projects || []).forEach((p: any) => {
      const since = p.waiting_since ? new Date(p.waiting_since).getTime() : now;
      const daysWaiting = Math.floor((now - since) / 86400000);
      const enriched = { ...p, daysWaiting };
      if (p.waiting_on === "us") buckets.onYou.push(enriched);
      else if (p.waiting_on === "client") buckets.waitingClient.push(enriched);
      else buckets.other.push(enriched);
    });

    const total = (projects || []).length;
    const fmtLine = (p: any) =>
      `• ${p.name || p.properties?.address || "Untitled"}${p.project_number ? ` (#${p.project_number})` : ""}${p.clients?.name ? ` — ${p.clients.name}` : ""}${p.waiting_note ? ` — ${p.waiting_note}` : ""}${p.daysWaiting ? ` · ${p.daysWaiting}d` : ""}`;

    const bodyLines: string[] = [];
    bodyLines.push(`${oooName} is out ${profile.ooo_from} → ${profile.ooo_to}.`);
    if (profile.ooo_note) bodyLines.push(`Note: ${profile.ooo_note}`);
    bodyLines.push(`Covering ${total} open project${total === 1 ? "" : "s"}.`);
    if (buckets.onYou.length) {
      bodyLines.push("", `🔴 Ball in our court (${buckets.onYou.length}):`);
      buckets.onYou.slice(0, 10).forEach((p) => bodyLines.push(fmtLine(p)));
    }
    if (buckets.waitingClient.length) {
      bodyLines.push("", `🟡 Waiting on client (${buckets.waitingClient.length}):`);
      buckets.waitingClient.slice(0, 10).forEach((p) => bodyLines.push(fmtLine(p)));
    }
    if (buckets.other.length) {
      bodyLines.push("", `⚪️ Other (${buckets.other.length}):`);
      buckets.other.slice(0, 10).forEach((p) => bodyLines.push(fmtLine(p)));
    }

    const body = bodyLines.join("\n");
    const title = `OOO Handoff: ${oooName} (${profile.ooo_from} → ${profile.ooo_to})`;

    const { error: notifErr } = await admin.from("notifications").insert({
      company_id: profile.company_id,
      user_id: profile.ooo_covering_pm_id,
      type: "ooo_handoff",
      title,
      body,
      link: "/projects",
    });
    if (notifErr) throw notifErr;

    return new Response(JSON.stringify({
      success: true,
      total,
      onYou: buckets.onYou.length,
      waitingClient: buckets.waitingClient.length,
      other: buckets.other.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("generate-ooo-handoff error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
