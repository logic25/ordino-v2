import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List projects visible to the signed-in user (respects RLS and company scoping). Read-only.",
  inputSchema: {
    status: z.string().optional().describe("Filter by project status, e.g. 'open', 'closed'."),
    client_id: z.string().uuid().optional().describe("Filter by client UUID."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("list_projects", async ({ status, client_id, limit }, _ctx, sb) => {
    let q = sb
      .from("projects")
      .select(
        "id, project_number, name, status, project_type, client_id, property_id, assigned_pm_id, project_complexity_tier, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (client_id) q = q.eq("client_id", client_id);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return empty("No projects visible to you.");
    return ok(`Found ${data.length} project(s).`, { rows: data });
  }),
});
