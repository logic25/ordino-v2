import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

export default defineTool({
  name: "list_dob_applications",
  title: "List DOB applications",
  description: "List DOB job filings for a project, property, or BIN. Read-only.",
  inputSchema: {
    project_id: z.string().uuid().optional(),
    property_id: z.string().uuid().optional(),
    bin: z.string().optional().describe("Building Identification Number (BIN)."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit(
    "list_dob_applications",
    async ({ project_id, property_id, bin, limit }, _ctx, sb) => {
      let propIds: string[] | undefined;
      if (bin) {
        const { data: props } = await sb.from("properties").select("id").eq("bin", bin);
        propIds = props?.map((p) => p.id) ?? [];
        if (!propIds.length) return empty(`No properties found for BIN ${bin}.`);
      }
      let q = sb
        .from("dob_applications")
        .select(
          "id, job_number, application_type, status, examiner_name, filed_date, approved_date, permit_issued_date, project_id, property_id, updated_at",
        )
        .order("filed_date", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (project_id) q = q.eq("project_id", project_id);
      if (property_id) q = q.eq("property_id", property_id);
      if (propIds) q = q.in("property_id", propIds);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) return empty("No DOB applications match.");
      return ok(`Found ${data.length} DOB application(s).`, { rows: data });
    },
  ),
});
