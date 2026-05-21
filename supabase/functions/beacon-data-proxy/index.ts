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
      case "query_ordino":
        return await queryOrdino(supabase, params);
      case "query_bug_patterns":
        return await queryBugPatterns(supabase, params);
      case "create_bug_from_conversation":
        return await createBugFromConversation(supabase, params);
      case "vendor_lookup":
        return await vendorLookup(supabase, params);
      case "list_schema":
        return await listSchema(supabase);
      case "describe_table":
        return await describeTable(params);
      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("beacon-data-proxy error:", err);
    return fail("Internal server error", 500);
  }
});

// ── Actions ──────────────────────────────────────────────

// Status aliases: map common synonyms to valid project_status enum values
const STATUS_ALIASES: Record<string, string> = {
  active: "open",
  in_progress: "open",
  "in progress": "open",
  ongoing: "open",
  current: "open",
  paused: "on_hold",
  hold: "on_hold",
  on_hold: "on_hold",
  completed: "closed",
  done: "closed",
  finished: "closed",
  archived: "closed",
};

function resolveStatus(raw: string): string {
  return STATUS_ALIASES[raw.toLowerCase()] ?? raw;
}

async function queryProjects(sb: any, params: any) {
  let q = sb
    .from("projects")
    .select(
      "id, name, project_number, status, filing_type, created_at, properties(address, borough, bin), profiles!projects_assigned_pm_id_fkey(display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.status) q = q.eq("status", resolveStatus(params.status));
  if (params.assigned_to) q = q.eq("assigned_pm_id", params.assigned_to);
  if (params.search) q = q.ilike("name", `%${params.search}%`);

  const { data, error } = await q;
  if (error) {
    console.error("query_projects error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }
  return ok(data);
}

async function queryProjectDetail(sb: any, params: any) {
  let projectId = params.project_id;

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
  if (error) {
    console.error("query_project_detail error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }
  if (!project) return fail("Project not found", 404);

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
  if (error) {
    console.error("query_property_violations error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }

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
  if (error) {
    console.error("query_pm_workload error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }

  const results = [];
  for (const p of profiles || []) {
    const { count } = await sb
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("assigned_pm_id", p.id)
      .eq("status", "open");
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
    .eq("status", "open");

  if (params.project_id) q = q.eq("id", params.project_id);

  const { data: projects, error } = await q.limit(200);
  if (error) {
    console.error("check_filing_readiness error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }

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

    const pct = Math.min(Math.round((filled / TOTAL_FIELDS) * 100), 100);
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
  if (error) {
    console.error("query_proposals error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }

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
  if (error) {
    console.error("query_invoices error:", error.message, error.details, error.hint);
    return fail(error.message, 500);
  }

  const outstanding = (data || [])
    .filter((i: any) => !["paid", "void"].includes(i.status))
    .reduce((s: number, i: any) => s + (i.total_due || 0), 0);
  const paid = (data || []).reduce(
    (s: number, i: any) => s + (i.payment_amount || 0),
    0
  );

  return ok({ invoices: data, outstanding_total: outstanding, paid_total: paid });
}

// ── General-purpose query ────────────────────────────────

const BLOCKED_TABLES = new Set([
  "auth", "api_keys", "secrets", "user_roles",
]);

const BLOCKED_PATTERNS = ["password", "key", "secret", "token"];

// ── Column Alias Mapping ─────────────────────────────────

const COLUMN_ALIASES: Record<string, Record<string, string>> = {
  companies: { tax_id: "ein", company_name: "name", tax_number: "ein" },
  invoices: { total_amount: "total_due", paid_amount: "payment_amount", amount_paid: "payment_amount" },
  services: { service_name: "name", fee: "fixed_price", price: "fixed_price" },
  projects: { pm: "assigned_pm_id", project_manager: "assigned_pm_id" },
  profiles: { goal: "monthly_goal", billing_goal: "monthly_goal" },
};

// ── Value Alias Mapping (enum synonyms) ──────────────────
const VALUE_ALIASES: Record<string, Record<string, Record<string, string>>> = {
  projects: {
    status: {
      active: "open", in_progress: "open", "in progress": "open",
      ongoing: "open", current: "open",
      paused: "on_hold", hold: "on_hold",
      completed: "closed", done: "closed", finished: "closed", archived: "closed",
    },
  },
};

function resolveAlias(table: string, column: string): string {
  return COLUMN_ALIASES[table]?.[column] || column;
}

function resolveValue(table: string, column: string, value: any): any {
  if (typeof value !== "string") return value;
  return VALUE_ALIASES[table]?.[column]?.[value.toLowerCase()] ?? value;
}

function resolveSelectAliases(table: string, select: string): string {
  if (select === "*") return select;
  return select.split(",").map((s) => {
    const trimmed = s.trim();
    // Skip relation selects like "profiles(display_name)"
    if (trimmed.includes("(")) return trimmed;
    return resolveAlias(table, trimmed);
  }).join(", ");
}

function isTableBlocked(table: string): boolean {
  const t = table.toLowerCase().trim();
  if (BLOCKED_TABLES.has(t)) return true;
  if (t.startsWith("auth.")) return true;
  for (const p of BLOCKED_PATTERNS) {
    if (t.includes(p)) return true;
  }
  return false;
}

async function queryOrdino(sb: any, params: any) {
  const { table, select, filters, order, limit } = params || {};

  if (!table || typeof table !== "string") {
    return fail("Missing or invalid 'table' param");
  }

  if (isTableBlocked(table)) {
    return fail(`Access to table '${table}' is not allowed`, 403);
  }

  const safeSelect = resolveSelectAliases(table, select || "*");
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  let q = sb.from(table).select(safeSelect).limit(safeLimit);

  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (!f.column) continue;
      const col = resolveAlias(table, f.column);
      const val = resolveValue(table, col, f.value);
      const op = f.operator || "eq";
      switch (op) {
        case "eq":    q = q.eq(col, val); break;
        case "neq":   q = q.neq(col, val); break;
        case "gt":    q = q.gt(col, val); break;
        case "gte":   q = q.gte(col, val); break;
        case "lt":    q = q.lt(col, val); break;
        case "lte":   q = q.lte(col, val); break;
        case "like":  q = q.like(col, val); break;
        case "ilike": q = q.ilike(col, val); break;
        case "is":    q = q.is(col, val); break;
        case "in":    q = q.in(col, Array.isArray(val) ? val.map((v: any) => resolveValue(table, col, v)) : val); break;
        default:      q = q.eq(col, val);
      }
    }
  }

  if (order && order.column) {
    q = q.order(resolveAlias(table, order.column), { ascending: order.ascending !== false });
  }

  const { data, error } = await q;
  if (error) {
    console.error("query_ordino error:", error.message, error.details, error.hint);

    // Auto-fetch schema hint so caller can self-correct
    let schemaHint = null;
    try {
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (dbUrl) {
        const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
        const sql = postgres(dbUrl, { max: 1 });
        const rows = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} ORDER BY ordinal_position`;
        schemaHint = rows.map((r: any) => ({ name: r.column_name, type: r.data_type }));
        await sql.end();
      }
    } catch { /* ignore schema hint failure */ }

    return new Response(JSON.stringify({
      data: null,
      error: error.message,
      schema_hint: schemaHint,
      suggestion: schemaHint ? `Available columns: ${schemaHint.map((c: any) => c.name).join(", ")}` : null,
    }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return ok({ rows: data, count: data?.length ?? 0 });
}

// ── Bug pattern intelligence ─────────────────────────────

async function queryBugPatterns(sb: any, params: any) {
  const { search, file_path, limit: rawLimit } = params || {};
  const safeLimit = Math.min(Math.max(Number(rawLimit) || 20, 1), 100);

  let q = sb
    .from("bug_patterns")
    .select("*")
    .order("occurrences", { ascending: false })
    .limit(safeLimit);

  const { data, error } = await q;
  if (error) {
    console.error("query_bug_patterns error:", error.message);
    return fail(error.message, 500);
  }

  let results = data || [];

  // Filter by search term (keyword match on pattern_name or root_cause)
  if (search && typeof search === "string") {
    const terms = search.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    results = results.filter((p: any) => {
      const text = `${p.pattern_name} ${p.root_cause} ${p.fix_pattern}`.toLowerCase();
      return terms.some((t: string) => text.includes(t));
    });
  }

  // Filter by affected file path
  if (file_path && typeof file_path === "string") {
    results = results.filter((p: any) =>
      (p.affected_files || []).some((f: string) =>
        f.includes(file_path) || file_path.includes(f)
      )
    );
  }

  return ok({
    patterns: results,
    count: results.length,
    total_occurrences: results.reduce((s: number, p: any) => s + (p.occurrences || 0), 0),
  });
}

// ── Conversational bug creation ──────────────────────────

async function createBugFromConversation(sb: any, params: any) {
  const { title, description, page, ai_diagnosis, reporter_id, company_id } = params || {};

  if (!title || !company_id || !reporter_id) {
    return fail("Missing required fields: title, company_id, reporter_id");
  }

  // Insert into feature_requests as a bug_report
  const { data: bug, error } = await sb
    .from("feature_requests")
    .insert({
      title,
      description: description || "",
      category: "bug_report",
      status: "new",
      priority: "medium",
      page: page || null,
      user_id: reporter_id,
      company_id,
      ai_diagnosis: ai_diagnosis || null,
      source: "beacon_conversation",
    })
    .select("id, title, status")
    .single();

  if (error) {
    console.error("create_bug_from_conversation error:", error.message);
    return fail(error.message, 500);
  }

  // Auto-trigger triage (non-blocking)
  try {
    const triageUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/triage-bug-report";
    fetch(triageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ bug_id: bug.id }),
    }).catch(e => console.error("Auto-triage trigger failed:", e));
  } catch (e) {
    console.error("Auto-triage trigger failed:", e);
  }

  return ok({ bug_id: bug.id, title: bug.title, status: bug.status });
}

// ── Vendor / Partner Lookup ──────────────────────────────

async function vendorLookup(sb: any, params: any) {
  const { type, search, limit: rawLimit } = params || {};
  const safeLimit = Math.min(Math.max(Number(rawLimit) || 10, 1), 50);

  let q = sb
    .from("clients")
    .select("id, name, email, client_type, is_rfp_partner, address, specialty_tags, internal_notes")
    .eq("is_rfp_partner", true)
    .limit(200);

  if (type) q = q.ilike("client_type", `%${type}%`);
  if (search) q = q.ilike("name", `%${search}%`);

  const { data: clients, error: clientErr } = await q;
  if (clientErr) {
    console.error("vendor_lookup clients error:", clientErr.message);
    return fail(clientErr.message, 500);
  }
  if (!clients || clients.length === 0) {
    return ok({ vendors: [], count: 0, message: type ? `No partners found with type "${type}"` : "No RFP partners found" });
  }

  const clientIds = clients.map((c: any) => c.id);
  const clientNames = clients.map((c: any) => c.name).filter(Boolean);

  // Past-projects filter (name-match on architect/gc text fields)
  const projectsFilter = clientNames.flatMap((n: string) => {
    const esc = n.replace(/[,()*%]/g, "");
    return [`architect_company_name.ilike.%${esc}%`, `gc_company_name.ilike.%${esc}%`];
  }).join(",");

  const [reviewsRes, contactsRes, projectsRes] = await Promise.all([
    sb.from("company_reviews")
      .select("client_id, rating, review_text, reviewer_name, created_at")
      .in("client_id", clientIds),
    sb.from("client_contacts")
      .select("client_id, name, email, phone, title, is_primary")
      .in("client_id", clientIds)
      .order("is_primary", { ascending: false }),
    projectsFilter
      ? sb.from("projects")
          .select("id, architect_company_name, gc_company_name, created_at, properties(address)")
          .or(projectsFilter)
          .limit(500)
      : Promise.resolve({ data: [] }),
  ]);

  const reviews = reviewsRes.data || [];
  const contacts = contactsRes.data || [];
  const projects = (projectsRes as any).data || [];

  // Rating aggregation
  const ratingMap: Record<string, { sum: number; count: number; reviews: any[] }> = {};
  for (const r of reviews) {
    if (!ratingMap[r.client_id]) ratingMap[r.client_id] = { sum: 0, count: 0, reviews: [] };
    ratingMap[r.client_id].sum += r.rating;
    ratingMap[r.client_id].count++;
    ratingMap[r.client_id].reviews.push({
      rating: r.rating,
      text: r.review_text?.slice(0, 200),
      reviewer: r.reviewer_name,
      date: r.created_at,
    });
  }
  for (const cid of Object.keys(ratingMap)) {
    ratingMap[cid].reviews.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));
  }

  // Primary contact + collect emails for responsiveness
  const contactMap: Record<string, any> = {};
  const emailsByClient: Record<string, string[]> = {};
  for (const c of contacts) {
    if (!contactMap[c.client_id] || c.is_primary) {
      contactMap[c.client_id] = { name: c.name, email: c.email, phone: c.phone, title: c.title };
    }
    if (c.email) {
      if (!emailsByClient[c.client_id]) emailsByClient[c.client_id] = [];
      emailsByClient[c.client_id].push(c.email.toLowerCase());
    }
  }
  for (const c of clients) {
    if ((c as any).email) {
      if (!emailsByClient[c.id]) emailsByClient[c.id] = [];
      emailsByClient[c.id].push((c as any).email.toLowerCase());
    }
  }

  // Past projects per client (name match)
  const projectsByClient: Record<string, any[]> = {};
  for (const c of clients) {
    const nameLower = (c.name || "").toLowerCase().trim();
    if (!nameLower) continue;
    const matched = projects.filter((p: any) =>
      (p.architect_company_name || "").toLowerCase().includes(nameLower) ||
      (p.gc_company_name || "").toLowerCase().includes(nameLower)
    );
    if (matched.length) {
      matched.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      projectsByClient[c.id] = matched;
    }
  }

  // Responsiveness: median email reply time over last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const allPartnerEmails = Array.from(new Set(Object.values(emailsByClient).flat()));
  const responsivenessByClient: Record<string, { medianHours: number; bucket: string; sampleSize: number }> = {};

  if (allPartnerEmails.length > 0) {
    const orFromFilter = allPartnerEmails.map(e => `from_email.ilike.${e}`).join(",");
    const [inboundRes, outboundRes] = await Promise.all([
      sb.from("emails")
        .select("thread_id, from_email, to_emails, date")
        .gte("date", ninetyDaysAgo)
        .or(orFromFilter)
        .limit(5000),
      sb.from("emails")
        .select("thread_id, from_email, to_emails, date")
        .gte("date", ninetyDaysAgo)
        .overlaps("to_emails", allPartnerEmails)
        .limit(5000),
    ]);

    const allEmails = [...(inboundRes.data || []), ...(outboundRes.data || [])];
    const threads: Record<string, any[]> = {};
    for (const e of allEmails) {
      if (!e.thread_id) continue;
      if (!threads[e.thread_id]) threads[e.thread_id] = [];
      threads[e.thread_id].push(e);
    }
    for (const tid of Object.keys(threads)) {
      const seen = new Set<string>();
      threads[tid] = threads[tid]
        .filter((e: any) => {
          const k = `${e.date}|${e.from_email}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));
    }

    for (const [cid, partnerEmails] of Object.entries(emailsByClient)) {
      const setLower = new Set(partnerEmails);
      const gaps: number[] = [];
      for (const tid of Object.keys(threads)) {
        const msgs = threads[tid];
        const involved = msgs.some((m: any) =>
          setLower.has((m.from_email || "").toLowerCase()) ||
          (m.to_emails || []).some((t: string) => setLower.has((t || "").toLowerCase()))
        );
        if (!involved) continue;
        for (let i = 0; i < msgs.length - 1; i++) {
          const cur = msgs[i];
          const nxt = msgs[i + 1];
          const curFromPartner = setLower.has((cur.from_email || "").toLowerCase());
          const nxtFromPartner = setLower.has((nxt.from_email || "").toLowerCase());
          if (!curFromPartner && nxtFromPartner) {
            const dt = (new Date(nxt.date).getTime() - new Date(cur.date).getTime()) / 3600000;
            if (dt > 0 && dt < 24 * 30) gaps.push(dt);
          }
        }
      }
      if (gaps.length >= 3) {
        gaps.sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)];
        let bucket = "Unresponsive";
        if (median <= 4) bucket = "Fast";
        else if (median <= 24) bucket = "Same-day";
        else if (median <= 72) bucket = "Slow";
        responsivenessByClient[cid] = {
          medianHours: Math.round(median * 10) / 10,
          bucket,
          sampleSize: gaps.length,
        };
      }
    }
  }

  function borough(addr?: string | null): string | null {
    if (!addr) return null;
    const a = addr.toLowerCase();
    if (a.includes("brooklyn")) return "Brooklyn";
    if (a.includes("queens")) return "Queens";
    if (a.includes("bronx")) return "Bronx";
    if (a.includes("staten island")) return "Staten Island";
    if (a.includes("manhattan") || /\bnew york, ny\b/.test(a)) return "Manhattan";
    return null;
  }

  const vendors = clients.map((c: any) => {
    const r = ratingMap[c.id];
    const past = projectsByClient[c.id] || [];
    const lastProj = past[0];
    const lastAddr = lastProj?.properties?.address || null;
    const lastMonth = lastProj?.created_at
      ? new Date(lastProj.created_at).toLocaleString("en-US", { month: "short", year: "numeric" })
      : null;
    const resp = responsivenessByClient[c.id];

    return {
      id: c.id,
      name: c.name,
      type: c.client_type,
      borough: borough(c.address),
      avg_rating: r ? Math.round((r.sum / r.count) * 10) / 10 : null,
      review_count: r?.count || 0,
      recent_reviews: (r?.reviews || []).slice(0, 2),
      past_jobs_count: past.length,
      last_worked: lastMonth ? { address: lastAddr, month: lastMonth } : null,
      responsiveness: resp || null,
      specialty_tags: c.specialty_tags || [],
      internal_notes: c.internal_notes || null,
      contact: contactMap[c.id] || null,
    };
  });

  vendors.sort((a: any, b: any) => {
    const aR = a.avg_rating ?? 0;
    const bR = b.avg_rating ?? 0;
    if (bR !== aR) return bR - aR;
    if (b.past_jobs_count !== a.past_jobs_count) return b.past_jobs_count - a.past_jobs_count;
    return b.review_count - a.review_count;
  });

  return ok({
    vendors: vendors.slice(0, safeLimit),
    count: vendors.length,
    query: { type, search },
  });
}

// ── List Schema ──────────────────────────────────────────

async function listSchema(_sb: any) {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return fail("Database URL not configured");

  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
  const sql = postgres(dbUrl, { max: 1 });

  try {
    const rows = await sql`
      SELECT c.table_name, array_agg(c.column_name ORDER BY c.ordinal_position) as columns
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name IN (
          SELECT DISTINCT table_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name IN ('company_id', 'user_id')
        )
      GROUP BY c.table_name
      ORDER BY c.table_name
    `;

    const tables: Record<string, string[]> = {};
    for (const row of rows) {
      tables[row.table_name] = row.columns;
    }

    return ok({ tables });
  } finally {
    await sql.end();
  }
}

// ── Describe Table ───────────────────────────────────────

const DESCRIBE_BLOCKED_PATTERN = /auth|secret|password|key|token|user_roles/i;

async function describeTable(params: any) {
  const table = params?.table;
  if (!table || typeof table !== "string") return fail("Missing 'table' param");
  if (DESCRIBE_BLOCKED_PATTERN.test(table)) return fail("Access denied for that table");

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return fail("Database URL not configured");

  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
  const sql = postgres(dbUrl, { max: 1 });

  try {
    const rows = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `;

    if (rows.length === 0) return fail(`Table '${table}' not found`);

    return ok({
      table,
      columns: rows.map((r: any) => ({ name: r.column_name, type: r.data_type })),
    });
  } finally {
    await sql.end();
  }
}
