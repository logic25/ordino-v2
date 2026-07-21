import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "get_project_timeline",
  title: "Get project timeline",
  description: "List timeline events for a project (most recent first). Read-only.",
  inputSchema: {
    project_id: z.string().uuid(),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("get_project_timeline", async ({ project_id, limit }, _ctx, sb) => {
    const { data, error } = await sb
      .from("project_timeline_events")
      .select("id, event_type, description, actor_id, created_at, metadata")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data?.length) return empty("No timeline events for this project.");
    return ok(`Found ${data.length} timeline event(s).`, { rows: data });
  }),
});
