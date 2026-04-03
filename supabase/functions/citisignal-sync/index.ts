import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { property_id, bin } = await req.json();
    if (!property_id) {
      return new Response(JSON.stringify({ error: "property_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get CitiSignal config
    const citisignalApiUrl = Deno.env.get("CITISIGNAL_API_URL");
    const citisignalApiKey = Deno.env.get("CITISIGNAL_API_KEY");

    if (!citisignalApiUrl || !citisignalApiKey) {
      return new Response(JSON.stringify({ error: "CitiSignal not configured", fallback: true }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up property to get citisignal_property_id or use BIN
    const { data: property } = await supabase
      .from("properties")
      .select("citisignal_property_id, bin")
      .eq("id", property_id)
      .maybeSingle();

    const lookupBin = bin || property?.bin;
    let citisignalPropertyId = property?.citisignal_property_id;

    // If we don't have a CitiSignal property ID, look it up by BIN across all pages
    if (!citisignalPropertyId && lookupBin) {
      console.log(`Looking up CitiSignal property by BIN ${lookupBin}`);
      let page = 1;
      const perPage = 100;
      let found = false;

      while (!found) {
        const lookupUrl = `${citisignalApiUrl}/functions/v1/api-gateway?path=properties&per_page=${perPage}&page=${page}`;
        const lookupResp = await fetch(lookupUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${citisignalApiKey}`,
            "Content-Type": "application/json",
          },
        });
        if (!lookupResp.ok) {
          const errText = await lookupResp.text();
          console.error(`CitiSignal property lookup failed on page ${page}: ${lookupResp.status} — ${errText}`);
          break;
        }
        const lookupData = await lookupResp.json();
        const properties = lookupData?.data || lookupData || [];
        const list = Array.isArray(properties) ? properties : [];

        const matched = list.find((p: any) => String(p.bin) === String(lookupBin));
        if (matched?.id) {
          citisignalPropertyId = matched.id;
          console.log(`Resolved CitiSignal property: ${matched.id} for BIN ${lookupBin} (page ${page})`);
          await supabase.from("properties").update({ citisignal_property_id: matched.id }).eq("id", property_id);
          found = true;
        } else if (list.length < perPage) {
          // Last page — no more results
          console.log(`No CitiSignal property found for BIN ${lookupBin} after ${page} page(s).`);
          break;
        } else {
          page++;
          // Safety cap at 20 pages (2000 properties)
          if (page > 20) {
            console.log(`BIN ${lookupBin} not found after 20 pages — aborting lookup.`);
            break;
          }
        }
      }
    }

    if (!citisignalPropertyId) {
      return new Response(JSON.stringify({ error: "Could not resolve CitiSignal property ID", fallback: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call CitiSignal full-sync API
    const apiPath = `properties/${citisignalPropertyId}/full-sync`;
    const citisignalUrl = `${citisignalApiUrl}/functions/v1/api-gateway?path=${encodeURIComponent(apiPath)}`;
    console.log(`Calling CitiSignal: ${citisignalUrl}`);

    const citisignalResponse = await fetch(citisignalUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${citisignalApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!citisignalResponse.ok) {
      const errorText = await citisignalResponse.text();
      console.error(`CitiSignal API error: ${citisignalResponse.status} — ${errorText}`);
      return new Response(JSON.stringify({ error: "CitiSignal API error", fallback: true, detail: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const citisignalPayload = await citisignalResponse.json();
    const fullSyncData = citisignalPayload?.data ?? {};
    const propertyData = fullSyncData?.property ?? {};

    // ── Upsert applications ──
    const applications = fullSyncData?.applications || [];
    if (applications.length > 0) {
      const appRows = applications
        .filter((a: any) => a?.application_number || a?.job_number)
        .map((a: any) => ({
          property_id,
          company_id: profile.company_id,
          job_number: a.application_number || a.job_number || "",
          application_type: a.application_type || a.work_type || a.job_type || "Unknown",
          filing_status: a.status || a.filing_status || null,
          applicant_name: a.applicant_name || a.applicant || null,
          filed_date: a.filing_date || a.filed_date || null,
          description: a.description || null,
          raw_data: { ...a, source: a.source || "citisignal" },
        }));

      const { error: appErr } = await supabase
        .from("signal_applications")
        .upsert(appRows, { onConflict: "property_id,job_number" });

      if (appErr) console.error("Error upserting applications:", appErr);
    }

    // ── Upsert violations ──
    const violations = fullSyncData?.violations || [];
    if (violations.length > 0) {
      const violRows = violations
        .filter((v: any) => v?.violation_number || v?.isn_bis_vio)
        .map((v: any) => ({
          property_id,
          company_id: profile.company_id,
          violation_number: v.violation_number || v.isn_bis_vio || "",
          agency: v.agency || "DOB",
          violation_type: v.violation_type || v.violation_class || null,
          status: v.status || "open",
          description: v.description || v.description_raw || null,
          penalty_amount: v.penalty_amount || v.penalty_balance_due || 0,
          issued_date: v.issued_date || v.issue_date || null,
          raw_data: { ...v, source: v.source || "citisignal" },
        }));

      const { error: violErr } = await supabase
        .from("signal_violations")
        .upsert(violRows, { onConflict: "property_id,violation_number" });

      if (violErr) console.error("Error upserting violations:", violErr);
    }

    // ── Update property record with CitiSignal enrichment ──
    const propertyUpdates: Record<string, any> = {};

    if (propertyData.vacate_order !== undefined) {
      propertyUpdates.vacate_order = !!propertyData.vacate_order;
    }
    if (propertyData.vacate_type) {
      propertyUpdates.vacate_type = propertyData.vacate_type;
    }
    if (propertyData.co_status) {
      propertyUpdates.co_status = propertyData.co_status;
    }
    if (propertyData.bis_profile_data) {
      propertyUpdates.bis_profile_data = propertyData.bis_profile_data;
    }
    if (propertyData.id && propertyData.id !== citisignalPropertyId) {
      propertyUpdates.citisignal_property_id = propertyData.id;
    }

    if (Object.keys(propertyUpdates).length > 0) {
      propertyUpdates.updated_at = new Date().toISOString();
      const { error: propErr } = await supabase
        .from("properties")
        .update(propertyUpdates)
        .eq("id", property_id);

      if (propErr) console.error("Error updating property:", propErr);
    }

    return new Response(JSON.stringify({
      success: true,
      applications_count: applications.length,
      violations_count: violations.length,
      property_updates: Object.keys(propertyUpdates),
      applications,
      violations,
      property_enrichment: {
        vacate_order: propertyData.vacate_order || false,
        vacate_type: propertyData.vacate_type || null,
        co_status: propertyData.co_status || null,
        compliance_score: fullSyncData?.compliance_score?.score ?? fullSyncData?.compliance_score ?? null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("citisignal-sync error:", err);
    return new Response(JSON.stringify({ error: err.message, fallback: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
