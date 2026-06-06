// Generic tool executors. Every tool enforces:
//   1. Hard-block list  (refused even if added to allowlist)
//   2. Column allowlist (filter requested columns)
//   3. project_id ownership check against caller's company
//   4. Operational bounds (row caps)
import { assertTableAllowed, filterColumns, TABLES_WITHOUT_PROJECT_ID } from "./allowlist.ts";

const MAX_ROWS_QUERY = 25;
const MAX_ROWS_TOTAL_COUNT = 100; // cap returned to LLM in `total_matching_rows` (head-count via .head .count('exact'))

type SB = any; // Supabase service-role client

export interface Ctx {
  supabase: SB;
  companyId: string;
}

const OPS = new Set([
  "eq", "neq", "lt", "lte", "gt", "gte", "is_null", "not_null", "in", "ilike",
]);

function applyFilter(q: any, f: { column: string; op: string; value?: unknown }) {
  if (!OPS.has(f.op)) throw new Error(`bad_op:${f.op}`);
  switch (f.op) {
    case "eq":      return q.eq(f.column, f.value);
    case "neq":     return q.neq(f.column, f.value);
    case "lt":      return q.lt(f.column, f.value);
    case "lte":     return q.lte(f.column, f.value);
    case "gt":      return q.gt(f.column, f.value);
    case "gte":     return q.gte(f.column, f.value);
    case "is_null": return q.is(f.column, null);
    case "not_null":return q.not(f.column, "is", null);
    case "in":      return q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
    case "ilike":   return q.ilike(f.column, String(f.value));
  }
}

async function assertProjectAccess(ctx: Ctx, projectId: string): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (error) throw new Error(`project_lookup_failed:${error.message}`);
  if (!data) throw new Error("project_not_accessible");
}

export async function listProjects(ctx: Ctx, args: { query?: string; status?: string; limit?: number }) {
  const limit = Math.min(args.limit ?? 25, 25);
  let q = ctx.supabase
    .from("projects")
    .select("id, project_number, name, status, phase, last_activity_at, properties(address)")
    .eq("company_id", ctx.companyId)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (args.status) q = q.eq("status", args.status);
  if (args.query) {
    // Try project_number, name. Address is on joined properties — we filter client-side after fetching.
    q = q.or(`name.ilike.%${args.query}%,project_number.ilike.%${args.query}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`list_projects_failed:${error.message}`);
  const rows = (data || []).map((p: any) => ({
    id: p.id,
    project_number: p.project_number,
    name: p.name,
    status: p.status,
    phase: p.phase,
    address: p.properties?.address || null,
    last_activity_at: p.last_activity_at,
  }));
  // If address search and no hits via name/number, broaden by address.
  let augmented = rows;
  if (args.query && rows.length === 0) {
    const { data: byAddr } = await ctx.supabase
      .from("projects")
      .select("id, project_number, name, status, phase, last_activity_at, properties!inner(address)")
      .eq("company_id", ctx.companyId)
      .ilike("properties.address", `%${args.query}%`)
      .limit(limit);
    augmented = (byAddr || []).map((p: any) => ({
      id: p.id, project_number: p.project_number, name: p.name,
      status: p.status, phase: p.phase, address: p.properties?.address || null,
      last_activity_at: p.last_activity_at,
    }));
  }
  return { rows: augmented, total_matching_rows: augmented.length, truncated: false };
}

export async function getProject(ctx: Ctx, args: { project_id: string }) {
  await assertProjectAccess(ctx, args.project_id);
  const { data: p, error } = await ctx.supabase
    .from("projects")
    .select(`
      id, project_number, name, status, phase,
      waiting_on, waiting_since, waiting_note,
      expected_construction_start, estimated_construction_completion,
      last_activity_at, assigned_pm_id,
      properties(address, borough, block, lot, bin),
      clients!projects_client_id_fkey(name, client_type)
    `)
    .eq("id", args.project_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (error) throw new Error(`get_project_failed:${error.message}`);
  if (!p) throw new Error("project_not_accessible");

  // Sidecar counts
  const [{ count: openChecklist }, { count: openPis }, pmRes, srPmRes] = await Promise.all([
    ctx.supabase
      .from("project_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", args.project_id)
      .neq("status", "done"),
    ctx.supabase
      .from("pis_tracking")
      .select("id", { count: "exact", head: true })
      .eq("project_id", args.project_id)
      .is("fulfilled_at", null),
    p.assigned_pm_id
      ? ctx.supabase.from("profiles").select("display_name").eq("id", p.assigned_pm_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    project: {
      ...p,
      pm_name: pmRes?.data?.display_name || null,
    },
    open_checklist_items: openChecklist ?? 0,
    open_pis_fields: openPis ?? 0,
    ready_to_file: (openChecklist ?? 0) === 0 && (openPis ?? 0) === 0,
  };
}

export async function queryTable(ctx: Ctx, args: {
  table: string; project_id: string;
  columns?: string[]; filters?: any[];
  order_by?: string; order_desc?: boolean; limit?: number;
}) {
  assertTableAllowed(args.table);
  if (TABLES_WITHOUT_PROJECT_ID.has(args.table)) {
    throw new Error(`use_dedicated_tool_for:${args.table}`);
  }
  await assertProjectAccess(ctx, args.project_id);

  const cols = filterColumns(args.table, args.columns);
  const limit = Math.min(args.limit ?? MAX_ROWS_QUERY, MAX_ROWS_QUERY);

  // Total matching count (head-only).
  let countQ = ctx.supabase
    .from(args.table)
    .select("id", { count: "exact", head: true })
    .eq("project_id", args.project_id);
  for (const f of args.filters ?? []) countQ = applyFilter(countQ, f);
  const { count: totalCount, error: cntErr } = await countQ;
  if (cntErr) throw new Error(`count_failed:${cntErr.message || cntErr.code || JSON.stringify(cntErr)}`);

  let q = ctx.supabase
    .from(args.table)
    .select(cols.join(","))
    .eq("project_id", args.project_id)
    .limit(limit);
  for (const f of args.filters ?? []) q = applyFilter(q, f);
  if (args.order_by && cols.includes(args.order_by)) {
    q = q.order(args.order_by, { ascending: args.order_desc === false });
  }
  const { data, error } = await q;
  if (error) throw new Error(`query_failed:${error.message}`);

  const total = totalCount ?? (data?.length ?? 0);
  return {
    rows: data ?? [],
    total_matching_rows: total,
    truncated: total > (data?.length ?? 0),
  };
}

export async function countRows(ctx: Ctx, args: {
  table: string; project_id: string; filters?: any[];
}) {
  assertTableAllowed(args.table);
  if (TABLES_WITHOUT_PROJECT_ID.has(args.table)) {
    throw new Error(`use_dedicated_tool_for:${args.table}`);
  }
  await assertProjectAccess(ctx, args.project_id);
  let q = ctx.supabase
    .from(args.table)
    .select("id", { count: "exact", head: true })
    .eq("project_id", args.project_id);
  for (const f of args.filters ?? []) q = applyFilter(q, f);
  const { count, error } = await q;
  if (error) throw new Error(`count_failed:${error.message || error.code || JSON.stringify(error)}`);
  return { count: count ?? 0 };
}

export async function searchEmails(ctx: Ctx, args: {
  project_id: string;
  from?: string; since?: string; until?: string; q?: string; limit?: number;
}) {
  await assertProjectAccess(ctx, args.project_id);
  const limit = Math.min(args.limit ?? 25, 50);
  const since = args.since ?? new Date(Date.now() - 30 * 86400000).toISOString();

  let q = ctx.supabase
    .from("email_project_tags")
    .select(`
      tagged_at, category,
      emails!inner(id, subject, from_name, from_email, date, snippet)
    `)
    .eq("project_id", args.project_id)
    .gte("emails.date", since)
    .order("tagged_at", { ascending: false })
    .limit(limit);

  if (args.until) q = q.lte("emails.date", args.until);
  if (args.from) {
    q = q.or(`from_name.ilike.%${args.from}%,from_email.ilike.%${args.from}%`, {
      foreignTable: "emails",
    });
  }
  if (args.q) q = q.ilike("emails.subject", `%${args.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(`search_emails_failed:${error.message}`);

  const rows = (data || []).map((t: any) => ({
    id: t.emails?.id,
    subject: t.emails?.subject,
    from: [t.emails?.from_name, t.emails?.from_email].filter(Boolean).join(" "),
    date: t.emails?.date,
    snippet: t.emails?.snippet,
    category: t.category,
  }));

  return {
    rows,
    total_matching_rows: rows.length,
    truncated: rows.length >= limit,
    since_used: since,
  };
}

export const TOOL_REGISTRY: Record<string, (ctx: Ctx, args: any) => Promise<any>> = {
  list_projects: listProjects,
  get_project: getProject,
  query_table: queryTable,
  count_rows: countRows,
  search_emails: searchEmails,
};
