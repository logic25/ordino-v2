import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

const PROP_FIELDS =
  "id, address, borough, block, lot, bin, zip_code, owner_name, created_at, updated_at";

export default defineTool({
  name: "list_properties",
  title: "List properties",
  description:
    "List / search properties. Provide a text query, a client_id, or neither for the most recent set. Read-only.",
  inputSchema: {
    query: z.string().optional().describe("Search text on address, BIN, block/lot."),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("list_properties", async ({ query, limit }, _ctx, sb) => {
    let q = sb
      .from("properties")
      .select(PROP_FIELDS)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (query) {
      const pat = `%${query.replace(/[%_]/g, "\\$&")}%`;
      q = q.or(`address.ilike.${pat},bin.ilike.${pat},block.ilike.${pat},lot.ilike.${pat}`);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return empty("No properties visible to you.");
    return ok(`Found ${data.length} property(ies).`, { rows: data });
  }),
});
