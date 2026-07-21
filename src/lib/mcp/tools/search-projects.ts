import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "search_projects",
  title: "Search projects",
  description:
    "Full-text search on project name, number, and address (via property join). Read-only.",
  inputSchema: {
    query: z.string().min(1).describe("Search text."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("search_projects", async ({ query, limit }, _ctx, sb) => {
    const pat = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const { data, error } = await sb
      .from("projects")
      .select(
        "id, project_number, name, status, project_type, client_id, property_id, updated_at",
      )
      .or(`name.ilike.${pat},project_number.ilike.${pat},tenant_name.ilike.${pat}`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data?.length) return empty(`No projects match "${query}".`);
    return ok(`Found ${data.length} project(s) matching "${query}".`, { rows: data });
  }),
});
