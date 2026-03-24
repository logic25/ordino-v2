import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-beacon-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return new Response(JSON.stringify({ data: null, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("Method not allowed", 405);
  }

  try {
    // Auth: shared secret
    const beaconKey = req.headers.get("x-beacon-key") ?? "";
    const expectedKey = Deno.env.get("BEACON_ANALYTICS_KEY") ?? "";
    if (!expectedKey || beaconKey !== expectedKey) {
      return fail("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, params = {} } = await req.json();

    switch (action) {
      case "query_projects":
        return await queryProjects(supabase, params);
      case "query_project_detail":
        return await queryProjectDetail(supabase, params);
      case "query_property_violations":
        return await queryPropertyViolations(supabase, params);
      case "query_pm_workload":
        return await queryPmWorkload(supabase, params);
      case "check_filing_readiness":
        return await checkFilingReadiness(supabase, params);
      case "query_proposals":
        return await queryProposals(supabase, params);
      case "query_invoices":
        return await queryInvoices(supabase, params);
      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("beacon-data-proxy error:", err);
    return fail("Internal server error", 500);
  }
});

// ── Actions ──────────────────────────────────────────────

async function queryProjects(sb: any, params: any) {
  let q = sb
    .from("projects")
    .select(
      "id, name, project_number, status, filing_type, created_at, properties(address, borough, bin), profiles!projects_assigned_pm_fkey(display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.status) q = q.eq("status", params.status);
  if (params.assigned_to) q = q.eq("assigned_pm_id", params.assigned_to);
  if (params.search) q = q.ilike("name", `%${params.search}%`);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}

async function queryProjectDetail(sb: any, params: any) {
  let projectId = params.project_id;

  // Resolve by address
  if (!projectId && params.address) {
    const { data: prop } = await sb
      .from("properties")
      .select("id")
      .ilike("address", `%${params.address}%`)
      .limit(1)
      .maybeSingle();
    if (prop) {
      const { data: proj } = await sb
        .from("projects")
        .select("id")
        .eq("property_id", prop.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (proj) projectId = proj.id;
    }
  }

  if (!projectId) return fail("Project not found", 404);

  const { data: project, error } = await sb
    .from("projects")
    .select(
      "*, properties(*), services(*), project_contacts(*, client_contacts(*))"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!project) return fail("Project not found", 404);

  // PIS completion
  const { data: rfi } = await sb
    .from("rfi_requests")
    .select("responses, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pisFieldCount = 0;
  if (rfi?.responses) {
    const resp =
      typeof rfi.responses === "string"
        ? JSON.parse(rfi.responses)
        : rfi.responses;
    pisFieldCount = Object.values(resp).filter(
      (v) => v !== null && v !== "" && v !== undefined
    ).length;
  }

  return ok({
    ...project,
    pis: { status: rfi?.status ?? "none", filled_fields: pisFieldCount },
  });
}

async function queryPropertyViolations(sb: any, params: any) {
  let propertyId: string | null = null;

  if (params.bin) {
    const { data: prop } = await sb
      .from("properties")
      .select("id")
      .eq("bin", params.bin)
      .limit(1)
      .maybeSingle();
    if (prop) propertyId = prop.id;
  } else if (params.address) {
    const { data: prop } = await sb
      .from("properties")
      .select("id")
      .ilike("address", `%${params.address}%`)
      .limit(1)
      .maybeSingle();
    if (prop) propertyId = prop.id;
  }

  if (!propertyId) return fail("Property not found", 404);

  let q = sb
    .from("signal_violations")
    .select("*")
    .eq("property_id", propertyId)
    .order("issue_date", { ascending: false })
    .limit(500);

  if (params.status) q = q.eq("status", params.status);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);

  const totalPenalty = (data || []).reduce(
    (s: number, v: any) => s + (v.penalty_amount || 0),
    0
  );

  return ok({ violations: data, total_penalty: totalPenalty, count: data?.length ?? 0 });
}

async function queryPmWorkload(sb: any, params: any) {
  let q = sb
    .from("profiles")
    .select("id, display_name, role")
    .eq("is_active", true);

  if (params.pm_name) q = q.ilike("display_name", `%${params.pm_name}%`);

  const { data: profiles, error } = await q;
  if (error) return fail(error.message, 500);

  const results = [];
  for (const p of profiles || []) {
    const { count } = await sb
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("assigned_pm_id", p.id)
      .in("status", ["active", "in_progress", "filing", "pre_filing"]);
    results.push({
      id: p.id,
      name: p.display_name,
      role: p.role,
      active_projects: count ?? 0,
    });
  }

  results.sort((a: any, b: any) => b.active_projects - a.active_projects);
  return ok(results);
}

async function checkFilingReadiness(sb: any, params: any) {
  const TOTAL_FIELDS = 23;

  let q = sb
    .from("projects")
    .select("id, name, project_number")
    .in("status", ["active", "in_progress", "filing", "pre_filing"]);

  if (params.project_id) q = q.eq("id", params.project_id);

  const { data: projects, error } = await q.limit(200);
  if (error) return fail(error.message, 500);

  const results = [];
  for (const p of projects || []) {
    const { data: rfi } = await sb
      .from("rfi_requests")
      .select("responses")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let filled = 0;
    if (rfi?.responses) {
      const resp =
        typeof rfi.responses === "string"
          ? JSON.parse(rfi.responses)
          : rfi.responses;
      filled = Object.values(resp).filter(
        (v) => v !== null && v !== "" && v !== undefined
      ).length;
    }

    const pct = Math.round((filled / TOTAL_FIELDS) * 100);
    if (params.min_readiness && pct < params.min_readiness) continue;

    results.push({
      project_id: p.id,
      name: p.name,
      project_number: p.project_number,
      filled_fields: filled,
      total_fields: TOTAL_FIELDS,
      readiness_pct: pct,
    });
  }

  results.sort((a: any, b: any) => b.readiness_pct - a.readiness_pct);
  return ok(results);
}

async function queryProposals(sb: any, params: any) {
  let q = sb
    .from("proposals")
    .select(
      "id, proposal_number, status, total_amount, client_name, created_at, properties(address)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.status) q = q.eq("status", params.status);
  if (params.search)
    q = q.or(`client_name.ilike.%${params.search}%,title.ilike.%${params.search}%`);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);

  const totalPipeline = (data || []).reduce(
    (s: number, p: any) => s + (p.total_amount || 0),
    0
  );

  return ok({ proposals: data, total_pipeline_value: totalPipeline });
}

async function queryInvoices(sb: any, params: any) {
  let q = sb
    .from("invoices")
    .select(
      "id, invoice_number, status, total_due, payment_amount, paid_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (params.status) q = q.eq("status", params.status);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);

  const outstanding = (data || [])
    .filter((i: any) => !["paid", "void"].includes(i.status))
    .reduce((s: number, i: any) => s + (i.total_due || 0), 0);
  const paid = (data || []).reduce(
    (s: number, i: any) => s + (i.payment_amount || 0),
    0
  );

  return ok({ invoices: data, outstanding_total: outstanding, paid_total: paid });
}
