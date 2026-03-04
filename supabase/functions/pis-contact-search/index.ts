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

    // Validate token and get company_id
    const { data: rfiRequest, error: rfiError } = await supabase
      .from("rfi_requests")
      .select("company_id")
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

    // Search client_contacts
    const { data: contacts } = await supabase
      .from("client_contacts")
      .select(
        "id, name, first_name, last_name, email, phone, mobile, company_name, address_1, city, state, zip, license_type, license_number, specialty"
      )
      .eq("company_id", companyId)
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},company_name.ilike.${searchTerm}`)
      .limit(10);

    // Search clients (companies)
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, email, phone, address")
      .eq("company_id", companyId)
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(5);

    const results = [
      ...(contacts || []).map((c: any) => ({
        id: c.id,
        type: "contact" as const,
        name: c.name,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone || c.mobile,
        company_name: c.company_name,
        address: [c.address_1, c.city, c.state, c.zip].filter(Boolean).join(", "),
        license_type: c.license_type,
        license_number: c.license_number,
        specialty: c.specialty,
      })),
      ...(clients || []).map((c: any) => ({
        id: c.id,
        type: "client" as const,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company_name: c.name,
        address: c.address,
      })),
    ];

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
