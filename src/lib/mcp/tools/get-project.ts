import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, ok, withAudit } from "../_shared";

export default defineTool({
  name: "get_project",
  title: "Get project",
  description: "Get full detail for a single project (RLS-scoped). Read-only.",
  inputSchema: { project_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("get_project", async ({ project_id }, _ctx, sb) => {
    const { data, error } = await sb
      .from("projects")
      .select(
        `id, project_number, name, status, project_type, floor_number, unit_number,
         tenant_name, client_id, property_id, assigned_pm_id, senior_pm_id,
         project_complexity_tier, expected_construction_start,
         estimated_construction_completion, actual_construction_start,
         actual_construction_completion, completion_date, is_external, notable,
         created_at, updated_at,
         properties!projects_property_id_fkey ( id, address, borough, bin, block, lot, zip_code ),
         clients!projects_client_id_fkey ( id, name )`,
      )
      .eq("id", project_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return empty("Project not found or not visible to you.");
    return ok(`Project ${data.project_number ?? data.id}: ${data.name ?? "(unnamed)"}.`, data);
  }),
});
