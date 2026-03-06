import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const serviceId = url.searchParams.get("service_id");

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate: accept JWT or service-role key
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let supabase: any;
    let companyId: string | null = null;

    // Check if using service role key (for agent service)
    if (authHeader === `Bearer ${serviceRoleKey}`) {
      supabase = createClient(supabaseUrl, serviceRoleKey);
    } else {
      // JWT auth for browser calls
      supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      companyId = profile?.company_id;
    }

    // Fetch project with property
    const projectQuery = supabase
      .from("projects")
      .select(`
        id, company_id, project_number, name, phase, status,
        floor_number, unit_number, estimated_value, notes,
        filing_type, client_reference_number,
        gc_company_name, gc_contact_name, gc_phone, gc_email,
        building_owner_name, building_owner_id,
        sia_name, sia_company, sia_phone, sia_email, sia_number, sia_nys_lic,
        tpp_name, tpp_email,
        architect_license_type, architect_license_number,
        properties (
          id, address, borough, block, lot, bin, bbl
        )
      `)
      .eq("id", projectId)
      .maybeSingle();

    const { data: project, error: projError } = await projectQuery;
    if (projError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Company scope check for JWT users
    if (companyId && project.company_id !== companyId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch service if provided
    let service: any = null;
    if (serviceId) {
      const { data } = await supabase
        .from("services")
        .select("id, name, fixed_price, total_amount, billing_type, status, estimated_costs, sub_services, job_description")
        .eq("id", serviceId)
        .maybeSingle();
      service = data;
    }

    // Fetch PIS responses
    const { data: pisData } = await supabase
      .from("rfi_requests")
      .select("responses")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const pis = pisData?.responses || {};

    // Fetch contacts
    const { data: contacts } = await supabase
      .from("client_contacts")
      .select("id, name, email, phone, company, dob_role, dob_registered, discipline, address_line1, address_line2, address_city, address_state, address_zip")
      .eq("project_id", projectId);

    // Build structured payload by DOB NOW sections
    const property = project.properties;
    const address = property?.address || "";
    const houseNumber = address.match(/^(\d+[\w-]*)/)?.[1] || null;
    const streetName = address.replace(/^(\d+[\w-]*)\s*/, "") || null;

    // PIS helpers
    const pisVal = (section: string, field: string) => {
      const key = `${section}_${field}`;
      return pis[key] ?? pis[field] ?? null;
    };

    const workTypes = (() => {
      const pisWt = pisVal("building_scope", "work_types") || pisVal("building_and_scope", "work_types");
      if (Array.isArray(pisWt)) return pisWt;
      if (typeof pisWt === "string") { try { return JSON.parse(pisWt); } catch {} }
      return service?.sub_services || [];
    })();

    const jobDescription = pisVal("building_scope", "job_description") || pisVal("building_and_scope", "job_description") || service?.job_description || null;
    const sqFt = pisVal("building_scope", "sq_ft") || pisVal("building_and_scope", "sq_ft") || null;

    const payload = {
      project_id: project.id,
      project_number: project.project_number,
      service_id: serviceId,
      service_name: service?.name || null,

      location: {
        house_number: houseNumber,
        street_name: streetName,
        full_address: address,
        borough: property?.borough || null,
        block: property?.block || null,
        lot: property?.lot || null,
        bin: property?.bin || null,
        bbl: property?.bbl || null,
      },

      applicant_owner: {
        building_owner_name: project.building_owner_name || null,
        applicant_license_type: project.architect_license_type || pisVal("applicant_and_owner", "applicant_lic_type"),
        applicant_license_number: project.architect_license_number || pisVal("applicant_and_owner", "applicant_nys_lic"),
        owner_name: pisVal("applicant_and_owner", "owner_name") || project.building_owner_name,
      },

      filing_details: {
        filing_type: project.filing_type || pisVal("building_and_scope", "filing_type") || pisVal("applicant_and_owner", "filing_type"),
        work_types: workTypes,
        job_description: jobDescription,
        floor: project.floor_number || null,
        unit: project.unit_number || null,
        square_footage: sqFt,
        estimated_cost: project.estimated_value || null,
        client_reference_number: project.client_reference_number || null,
      },

      stakeholders: {
        gc: {
          company: project.gc_company_name || null,
          name: project.gc_contact_name || null,
          phone: project.gc_phone || null,
          email: project.gc_email || null,
        },
        sia: {
          name: project.sia_name || null,
          company: project.sia_company || null,
          phone: project.sia_phone || null,
          email: project.sia_email || null,
          number: project.sia_number || null,
          nys_lic: project.sia_nys_lic || null,
        },
        tpp: {
          name: project.tpp_name || null,
          email: project.tpp_email || null,
        },
      },

      contacts: (contacts || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        dob_role: c.dob_role,
        dob_registered: c.dob_registered,
        discipline: c.discipline,
        address: c.address_line1
          ? [c.address_line1, c.address_line2, `${c.address_city || ""} ${c.address_state || ""} ${c.address_zip || ""}`.trim()].filter(Boolean).join(", ")
          : null,
      })),
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("filing-payload error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
