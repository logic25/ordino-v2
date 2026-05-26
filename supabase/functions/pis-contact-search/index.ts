import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, query } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token and get company_id + project_id scope
    const { data: rfiRequest, error: rfiError } = await supabase
      .from("rfi_requests")
      .select("company_id, project_id, proposal_id")
      .eq("access_token", token)
      .maybeSingle();

    if (rfiError || !rfiRequest?.company_id) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = rfiRequest.company_id;
    const searchTerm = `%${query.trim()}%`;

    // Resolve allowed client_ids scoped to this RFI's project/proposal
    const allowedClientIds = new Set<string>();
    if (rfiRequest.project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("client_id, building_owner_id")
        .eq("id", rfiRequest.project_id)
        .maybeSingle();
      if (proj?.client_id) allowedClientIds.add(proj.client_id);
      if (proj?.building_owner_id) allowedClientIds.add(proj.building_owner_id);
    }
    if (rfiRequest.proposal_id) {
      const { data: prop } = await supabase
        .from("proposals")
        .select("client_id")
        .eq("id", rfiRequest.proposal_id)
        .maybeSingle();
      if (prop?.client_id) allowedClientIds.add(prop.client_id);
    }

    if (allowedClientIds.size === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIdList = Array.from(allowedClientIds);

    // Search only client_contacts that belong to the RFI's linked clients
    const { data: contacts } = await supabase
      .from("client_contacts")
      .select(
        "id, name, first_name, last_name, email, phone, mobile, company_name, license_type, specialty"
      )
      .eq("company_id", companyId)
      .in("client_id", clientIdList)
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},company_name.ilike.${searchTerm}`)
      .limit(10);

    const results = (contacts || []).map((c: any) => ({
      id: c.id,
      type: "contact" as const,
      name: c.name,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone || c.mobile,
      company_name: c.company_name,
      license_type: c.license_type,
      specialty: c.specialty,
    }));

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("pis-contact-search error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
