import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { empty, limitSchema, ok, withAudit } from "../_shared";

const CONTACT_FIELDS =
  "id, client_id, name, first_name, last_name, title, email, phone, mobile, is_primary, license_type, license_number, specialty, licensed_jurisdictions, is_referrer, created_at";

export default defineTool({
  name: "search_contacts",
  title: "Search client contacts",
  description: "Search client contacts by name, email, or phone. Read-only.",
  inputSchema: {
    query: z.string().min(1),
    client_id: z.string().uuid().optional(),
    limit: limitSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withAudit("search_contacts", async ({ query, client_id, limit }, _ctx, sb) => {
    const pat = `%${query.replace(/[%_]/g, "\\$&")}%`;
    let q = sb
      .from("client_contacts")
      .select(CONTACT_FIELDS)
      .or(`name.ilike.${pat},email.ilike.${pat},phone.ilike.${pat},mobile.ilike.${pat}`)
      .order("name", { ascending: true })
      .limit(limit);
    if (client_id) q = q.eq("client_id", client_id);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return empty(`No contacts match "${query}".`);
    return ok(`Found ${data.length} contact(s).`, { rows: data });
  }),
});
