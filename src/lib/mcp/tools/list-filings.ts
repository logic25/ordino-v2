import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "list_filings",
  title: "List filings",
  description: "List filing records for a project. Read-only.",
  inputSchema: {
    project_id: z.string().uuid(),
    status: z.string().optional().describe("Filter by current_stage."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("list_filings", async ({ project_id, status, limit }, _ctx, sb) => {
    let q = sb
      .from("filings")
      .select(
        "id, discipline, agency, filing_number, current_stage, stage_entered_at, expected_next_milestone, blocked, blocked_reason, blocked_since, updated_at",
      )
      .eq("project_id", project_id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("current_stage", status);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return empty("No filings for this project.");
    return ok(`Found ${data.length} filing(s).`, { rows: data });
  }),
});
