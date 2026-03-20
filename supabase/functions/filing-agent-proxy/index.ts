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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ─── action: callback (server-to-server, no JWT) ───
    if (action === "callback") {
      const agentSecret = req.headers.get("x-agent-secret") ?? "";
      if (!agentSecret || agentSecret !== FILING_AGENT_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const body = await req.json();
      const { filing_run_id, status, step, error_message, agent_session_id, job_id, live_url, session_url, recording_url, screenshots } = body;
      const runId = filing_run_id ?? url.searchParams.get("run_id");

      if (!runId) {
        return new Response(JSON.stringify({ error: "filing_run_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: run, error: fetchError } = await supabase
        .from("filing_runs")
        .select("id, progress_log, status")
        .eq("id", runId)
        .maybeSingle();

      if (fetchError || !run) {
        return new Response(JSON.stringify({ error: "Filing run not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const progressLog = Array.isArray(run.progress_log) ? [...run.progress_log] : [];
      if (step) {
        progressLog.push({ step, status: status || "running", timestamp: new Date().toISOString() });
      }

      const update: Record<string, any> = { progress_log: progressLog };
      if (status) update.status = status;
      if (agent_session_id || job_id) update.agent_session_id = agent_session_id || job_id;
      if (error_message) update.error_message = error_message;
      if (live_url) update.live_url = live_url;
      if (session_url) update.session_url = session_url;
      if (recording_url) update.recording_url = recording_url;
      if (Array.isArray(screenshots) && screenshots.length > 0) update.screenshots = screenshots;

      if (status === "running" && !run.status?.includes("running")) {
        update.started_at = new Date().toISOString();
      }
      if (["completed", "failed", "review_needed"].includes(status)) {
        update.completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("filing_runs")
        .update(update)
        .eq("id", runId);

      if (updateError) {
        console.error("[filing-agent-proxy] callback update error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[filing-agent-proxy] callback processed for run:", runId, "status:", status || "(no change)");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── All other actions require JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const { project_id, service_id, filing_run_id } = body;
      console.log("[filing-agent-proxy] start-filing received:", JSON.stringify({ project_id, service_id, filing_run_id, user_company_id: profile.company_id }));

      if (!project_id) {
        return new Response(JSON.stringify({ error: "project_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read project data with the service role client after JWT auth has already passed.
      // We still enforce tenant isolation explicitly via company_id below.
      const { data: project, error: projError } = await supabase
        .from("projects")
        .select(`
          *,
          properties (*),
          services (*),
          project_contacts (*, client_contacts (*))
        `)
        .eq("id", project_id)
        .single();

      if (projError) {
        console.error("[filing-agent-proxy] Project query error:", JSON.stringify(projError));
      }
      if (!project) {
        console.error("[filing-agent-proxy] Project not found for id:", project_id, "user_company_id:", profile.company_id);
      }
      if (projError || !project) {
        return new Response(JSON.stringify({ error: "Project not found", details: projError?.message || "no rows" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[filing-agent-proxy] Project found:", JSON.stringify({
        project_id: project.id,
        project_company_id: project.company_id,
        user_company_id: profile.company_id,
      }));

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

      // Prefer explicitly linked project contacts from project_contacts; fall back to client contacts if none are linked
      let contacts: any[] = [];
      const linkedContacts = Array.isArray(project.project_contacts)
        ? project.project_contacts
            .map((pc: any) => pc.client_contacts)
            .filter(Boolean)
        : [];

      if (linkedContacts.length > 0) {
        contacts = linkedContacts;
      } else if (project.client_id) {
        const { data: contactData } = await supabase
          .from("client_contacts")
          .select("id, name, email, phone, company_name, specialty, license_number, license_type, address_1, address_2, city, state, zip")
          .eq("client_id", project.client_id);
        contacts = contactData || [];
      }

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
          bbl: (property?.borough && property?.block && property?.lot)
            ? `${property.borough}${String(property.block).padStart(5, '0')}${String(property.lot).padStart(4, '0')}`
            : null,
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
          estimated_cost: project.estimated_job_cost || null,
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

        contacts: contacts.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company_name,
          specialty: c.specialty,
          license_number: c.license_number,
          license_type: c.license_type,
          address: c.address_1
            ? [c.address_1, c.address_2, `${c.city || ""} ${c.state || ""} ${c.zip || ""}`.trim()].filter(Boolean).join(", ")
            : null,
        })),
      };

      // Build the request body in the structure the agent expects
      const callbackUrl = `${supabaseUrl}/functions/v1/filing-status?run_id=${encodeURIComponent(filing_run_id || "")}`;
      const requestBody = {
        filing_data: {
          filing_type: filingPayload.filing_details.filing_type,
          property: {
            house_number: filingPayload.location.house_number,
            street_name: filingPayload.location.street_name,
            borough: filingPayload.location.borough,
            block: filingPayload.location.block,
            lot: filingPayload.location.lot,
            bin: filingPayload.location.bin,
            bbl: filingPayload.location.bbl,
          },
          filing_details: {
            work_type: Array.isArray(filingPayload.filing_details.work_types)
              ? filingPayload.filing_details.work_types.join(", ")
              : filingPayload.filing_details.work_types,
            work_types: filingPayload.filing_details.work_types,
            job_description: filingPayload.filing_details.job_description,
            floor: filingPayload.filing_details.floor,
            unit: filingPayload.filing_details.unit,
            square_footage: filingPayload.filing_details.square_footage,
            estimated_cost: filingPayload.filing_details.estimated_cost,
            client_reference_number: filingPayload.filing_details.client_reference_number,
          },
          contacts: {
            applicant: {
              license_type: filingPayload.applicant_owner.applicant_license_type,
              license_number: filingPayload.applicant_owner.applicant_license_number,
            },
            owner: {
              name: filingPayload.applicant_owner.owner_name,
            },
            gc: filingPayload.stakeholders.gc,
            sia: filingPayload.stakeholders.sia,
            tpp: filingPayload.stakeholders.tpp,
            additional: filingPayload.contacts,
          },
        },
        project_id: project.id,
        service_id: service_id || null,
        filing_run_id: filing_run_id || null,
        initiated_by: profile.id,
        callback_url: callbackUrl,
      };

      // Forward to filing agent
      const targetUrl = `${FILING_AGENT_URL}/api/file`;
      console.log("[filing-agent-proxy] Sending POST to:", targetUrl);
      console.log("[filing-agent-proxy] Request body:", JSON.stringify(requestBody));

      let agentRes: Response;
      try {
        agentRes = await fetch(targetUrl, {
          method: "POST",
          headers: agentHeaders,
          body: JSON.stringify(requestBody),
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

      try {
        const agentJson = JSON.parse(agentData);
        const updates: Record<string, any> = {};
        if (agentJson.job_id) updates.agent_session_id = agentJson.job_id;
        if (agentJson.session_url) updates.session_url = agentJson.session_url;
        if (agentJson.recording_url) updates.recording_url = agentJson.recording_url;
        if (agentJson.live_url) updates.live_url = agentJson.live_url;
        if (filing_run_id && Object.keys(updates).length > 0) {
          await supabase
            .from("filing_runs")
            .update(updates)
            .eq("id", filing_run_id);
        }
      } catch {
        // Non-JSON agent response; just proxy it through.
      }

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

      const agentText = await agentRes.text();

      // If the external agent doesn't know about this job, fall back to the DB record
      if (agentRes.status === 404) {
        const { data: dbRun } = await supabase
          .from("filing_runs")
          .select("id, status, progress_log, error_message, session_url, recording_url, live_url, screenshots, started_at, completed_at")
          .eq("agent_session_id", jobId)
          .maybeSingle();

        if (dbRun) {
          return new Response(JSON.stringify(dbRun), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ status: "unknown", message: "Job not found in agent or database" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Persist live_url, session_url, recording_url if returned
      try {
        const agentJson = JSON.parse(agentText);
        const updates: Record<string, any> = {};
        if (agentJson.live_url) updates.live_url = agentJson.live_url;
        if (agentJson.session_url) updates.session_url = agentJson.session_url;
        if (agentJson.recording_url) updates.recording_url = agentJson.recording_url;

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("filing_runs")
            .update(updates)
            .eq("agent_session_id", jobId);
        }
      } catch { /* not JSON or no URLs */ }

      return new Response(agentText, {
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
