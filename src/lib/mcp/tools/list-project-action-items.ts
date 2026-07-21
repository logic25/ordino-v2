import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "list_project_action_items",
  title: "List project action items",
  description: "List action items for a project. Read-only.",
  inputSchema: {
    project_id: z.string().uuid(),
    status: z.string().optional().describe("Filter by status. Default: 'open'."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit(
    "list_project_action_items",
    async ({ project_id, status, limit }, _ctx, sb) => {
      let q = sb
        .from("project_action_items")
        .select(
          "id, title, description, status, priority, assigned_to, assigned_by, due_date, completed_at, service_id, created_at",
        )
        .eq("project_id", project_id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit);
      q = q.eq("status", status ?? "open");
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) return empty("No action items match.");
      return ok(`Found ${data.length} action item(s).`, { rows: data });
    },
  ),
});
