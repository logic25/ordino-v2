import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, ok, withAudit } from "../_shared";

export default defineTool({
  name: "get_property",
  title: "Get property",
  description: "Get a single property record. Read-only.",
  inputSchema: { property_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("get_property", async ({ property_id }, _ctx, sb) => {
    const { data, error } = await sb
      .from("properties")
      .select("*")
      .eq("id", property_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return empty("Property not found or not visible to you.");
    return ok(`Property: ${data.address}.`, data);
  }),
});
