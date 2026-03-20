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
    const FILING_AGENT_URL = Deno.env.get("FILING_AGENT_URL");
    const FILING_AGENT_SECRET = Deno.env.get("FILING_AGENT_SECRET");

    if (!FILING_AGENT_URL || !FILING_AGENT_SECRET) {
      return new Response(JSON.stringify({ error: "Filing agent not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Verify JWT for all actions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for company scoping
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentHeaders = {
      "Content-Type": "application/json",
      "X-Agent-Secret": FILING_AGENT_SECRET,
    };

    // ─── action: start-filing ───
    if (action === "start-filing") {
      const body = await req.json();
      const { project_id, service_id } = body;
      console.log("[filing-agent-proxy] start-filing received:", JSON.stringify({ project_id, service_id }));

      if (!project_id) {
        return new Response(JSON.stringify({ error: "project_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch filing payload using the existing filing-payload logic
      const { data: project, error: projError } = await supabase
        .from("projects")
        .select(`
          id, company_id, project_number, name, phase, status,
          floor_number, unit_number, estimated_value, estimated_job_cost, notes,
          filing_type, client_reference_number,
          gc_company_name, gc_contact_name, gc_phone, gc_email,
          building_owner_name, building_owner_id,
          sia_name, sia_company, sia_phone, sia_email, sia_number, sia_nys_lic,
          tpp_name, tpp_email,
          architect_license_type, architect_license_number,
          properties (
            id, address, borough, block, lot, bin
          )
        `)
        .eq("id", project_id)
        .maybeSingle();

      if (projError) {
        console.error("[filing-agent-proxy] Project query error:", JSON.stringify(projError));
      }
      if (!project) {
        console.error("[filing-agent-proxy] Project not found for id:", project_id);
      }
      if (projError || !project) {
        return new Response(JSON.stringify({ error: "Project not found", details: projError?.message || "no rows" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Company scope check
      if (project.company_id !== profile.company_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch service if provided
      let service: any = null;
      if (service_id) {
        const { data } = await supabase
          .from("services")
          .select("id, name, fixed_price, total_amount, billing_type, status, estimated_costs, sub_services, job_description")
          .eq("id", service_id)
          .maybeSingle();
        service = data;
      }

      // Fetch PIS responses
      const { data: pisData } = await supabase
        .from("rfi_requests")
        .select("responses")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const pis = pisData?.responses || {};

      // Fetch contacts
      const { data: contacts } = await supabase
        .from("client_contacts")
        .select("id, name, email, phone, company, dob_role, dob_registered, discipline, address_line1, address_line2, address_city, address_state, address_zip")
        .eq("project_id", project_id);

      // Build structured payload
      const property = project.properties;
      const address = property?.address || "";
      const houseNumber = address.match(/^(\d+[\w-]*)/)?.[1] || null;
      const streetName = address.replace(/^(\d+[\w-]*)\s*/, "") || null;

      const pisVal = (section: string, field: string) => {
        const key = `${section}_${field}`;
        return pis[key] ?? pis[field] ?? null;
      };

      const workTypes = (() => {
        const pisWt = pisVal("building_scope", "work_types") || pisVal("building_and_scope", "work_types");
        if (Array.isArray(pisWt)) return pisWt;
        if (typeof pisWt === "string") { try { return JSON.parse(pisWt); } catch { /* noop */ } }
        return service?.sub_services || [];
      })();

      const jobDescription = pisVal("building_scope", "job_description") || pisVal("building_and_scope", "job_description") || service?.job_description || null;
      const sqFt = pisVal("building_scope", "sq_ft") || pisVal("building_and_scope", "sq_ft") || null;

      const filingPayload = {
        project_id: project.id,
        project_number: project.project_number,
        project_name: project.name,
        service_id: service_id || null,
        service_name: service?.name || null,
        initiated_by: profile.id,

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
          estimated_cost: project.estimated_job_cost || project.estimated_value || null,
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

      // Forward to filing agent
      const targetUrl = `${FILING_AGENT_URL}/api/file`;
      console.log("[filing-agent-proxy] Sending POST to:", targetUrl);
      console.log("[filing-agent-proxy] Payload project_id:", filingPayload.project_id, "service_id:", filingPayload.service_id);

      let agentRes: Response;
      try {
        agentRes = await fetch(targetUrl, {
          method: "POST",
          headers: agentHeaders,
          body: JSON.stringify(filingPayload),
        });
      } catch (fetchErr) {
        console.error("[filing-agent-proxy] Fetch error:", fetchErr);
        return new Response(JSON.stringify({ error: "Failed to reach filing agent", details: String(fetchErr) }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const agentData = await agentRes.text();
      console.log("[filing-agent-proxy] Agent response status:", agentRes.status, "body:", agentData.substring(0, 500));

      return new Response(agentData, {
        status: agentRes.status,
        headers: { ...corsHeaders, "Content-Type": agentRes.headers.get("Content-Type") || "application/json" },
      });
    }

    // ─── action: status ───
    if (action === "status") {
      const jobId = url.searchParams.get("job_id");
      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const agentRes = await fetch(`${FILING_AGENT_URL}/api/status/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: agentHeaders,
      });

      const agentData = await agentRes.text();
      return new Response(agentData, {
        status: agentRes.status,
        headers: { ...corsHeaders, "Content-Type": agentRes.headers.get("Content-Type") || "application/json" },
      });
    }

    // ─── action: queue ───
    if (action === "queue") {
      const agentRes = await fetch(`${FILING_AGENT_URL}/api/queue`, {
        method: "GET",
        headers: agentHeaders,
      });

      const agentData = await agentRes.text();
      return new Response(agentData, {
        status: agentRes.status,
        headers: { ...corsHeaders, "Content-Type": agentRes.headers.get("Content-Type") || "application/json" },
      });
    }

    // ─── action: batch ───
    if (action === "batch") {
      const body = await req.json();
      const { project_ids } = body;

      if (!Array.isArray(project_ids) || project_ids.length === 0) {
        return new Response(JSON.stringify({ error: "project_ids array is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify all projects belong to user's company
      const { data: projects } = await supabase
        .from("projects")
        .select("id, company_id")
        .in("id", project_ids);

      const unauthorized = (projects || []).some((p: any) => p.company_id !== profile.company_id);
      if (unauthorized) {
        return new Response(JSON.stringify({ error: "Forbidden — projects outside your company" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const agentRes = await fetch(`${FILING_AGENT_URL}/api/batch`, {
        method: "POST",
        headers: agentHeaders,
        body: JSON.stringify({ project_ids, initiated_by: profile.id }),
      });

      const agentData = await agentRes.text();
      return new Response(agentData, {
        status: agentRes.status,
        headers: { ...corsHeaders, "Content-Type": agentRes.headers.get("Content-Type") || "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: start-filing, status, queue, batch" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Filing agent proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
