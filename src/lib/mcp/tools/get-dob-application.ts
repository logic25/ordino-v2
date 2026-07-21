import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, ok, withAudit } from "../_shared";

export default defineTool({
  name: "get_dob_application",
  title: "Get DOB application",
  description: "Get full detail for a single DOB application. Read-only.",
  inputSchema: { application_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("get_dob_application", async ({ application_id }, _ctx, sb) => {
    const { data, error } = await sb
      .from("dob_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return empty("DOB application not found or not visible to you.");
    return ok(`DOB application ${data.job_number ?? data.id}.`, data);
  }),
});
