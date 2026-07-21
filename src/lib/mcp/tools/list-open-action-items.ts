import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "list_open_action_items",
  title: "List my open action items",
  description:
    "List open action items across projects. Defaults to items assigned to the signed-in user. Read-only.",
  inputSchema: {
    assignee: z
      .string()
      .uuid()
      .optional()
      .describe("Profile UUID of the assignee. Defaults to the signed-in user."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("list_open_action_items", async ({ assignee, limit }, ctx, sb) => {
    const target = assignee ?? ctx.getUserId();
    const { data, error } = await sb
      .from("project_action_items")
      .select("id, title, status, priority, due_date, project_id, assigned_to, created_at")
      .eq("assigned_to", target)
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    if (!data?.length) return empty("No open action items for this user.");
    return ok(`Found ${data.length} open action item(s).`, { rows: data });
  }),
});
