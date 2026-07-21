import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, ok, withAudit } from "../_shared";

// Explicit safe-field allow-list. NEVER include internal_notes,
// expected_annual_value, expected_projects_per_year, or client_tier.
const CLIENT_FIELDS =
  "id, name, email, phone, fax, address, client_type, is_sia, is_rfp_partner, specialty_tags, licensed_jurisdictions, tax_id, ibm_number, ibm_number_expiration, hic_license, dob_tracking, dob_tracking_expiration, created_at, updated_at";

export default defineTool({
  name: "get_client",
  title: "Get client",
  description:
    "Get a client record. Excludes internal_notes, expected_annual_value, expected_projects_per_year, and client_tier. Read-only.",
  inputSchema: { client_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("get_client", async ({ client_id }, _ctx, sb) => {
    const { data, error } = await sb
      .from("clients")
      .select(CLIENT_FIELDS)
      .eq("id", client_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return empty("Client not found or not visible to you.");
    return ok(`Client: ${data.name}.`, data);
  }),
});
