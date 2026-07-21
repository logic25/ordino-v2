import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

// Explicit safe-field allow-list. Excludes internal_notes, expected_annual_value,
// expected_projects_per_year, client_tier, and all financial/tracking fields.
const CLIENT_FIELDS =
  "id, name, email, phone, address, client_type, is_sia, is_rfp_partner, specialty_tags, licensed_jurisdictions, hic_license, dob_tracking, dob_tracking_expiration, created_at, updated_at";

export default defineTool({
  name: "search_clients",
  title: "Search clients",
  description:
    "Search clients by name, email, or phone. Excludes internal notes and financial/tier fields. Read-only.",
  inputSchema: {
    query: z.string().min(1),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("search_clients", async ({ query, limit }, _ctx, sb) => {
    const pat = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const { data, error } = await sb
      .from("clients")
      .select(CLIENT_FIELDS)
      .or(`name.ilike.${pat},email.ilike.${pat},phone.ilike.${pat}`)
      .order("name", { ascending: true })
      .limit(limit);
    if (error) throw error;
    if (!data?.length) return empty(`No clients match "${query}".`);
    return ok(`Found ${data.length} client(s).`, { rows: data });
  }),
});
