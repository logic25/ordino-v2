import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "list_project_notes",
  title: "List project notes",
  description: "List notes attached to a project (most recent first). Read-only.",
  inputSchema: {
    project_id: z.string().uuid(),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("list_project_notes", async ({ project_id, limit }, _ctx, sb) => {
    const { data, error } = await sb
      .from("project_notes")
      .select("id, body, source, user_id, service_id, client_visible, created_at")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data?.length) return empty("No notes on this project.");
    return ok(`Found ${data.length} note(s).`, { rows: data });
  }),
});
