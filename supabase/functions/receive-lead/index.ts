import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // Validate required fields
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      service_needed,
      description,
      source = "website",
      company_slug,
    } = body;

    if (!first_name && !last_name && !email) {
      return new Response(
        JSON.stringify({ error: "At least a name or email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find company by slug (or use first company if not specified)
    let companyId: string;
    if (company_slug) {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("slug", company_slug)
        .single();
      if (companyError || !company) {
        return new Response(
          JSON.stringify({ error: "Company not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = company.id;
    } else {
      // Default to first company
      const { data: companies } = await supabase
        .from("companies")
        .select("id")
        .limit(1)
        .single();
      if (!companies) {
        return new Response(
          JSON.stringify({ error: "No company configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = companies.id;
    }

    // Find an admin to assign the lead to
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("role", "admin")
      .eq("is_active", true)
      .limit(1);

    const assignedPmId = admins && admins.length > 0 ? admins[0].id : null;

    const contactName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown";
    const title = `Lead: ${contactName}${address ? ` - ${address}` : ""}`;

    // Build notes from all available info
    const noteLines = [
      phone ? `Phone: ${phone}` : "",
      service_needed ? `Service: ${service_needed}` : "",
      description || "",
      `Source: ${source}`,
      `Received: ${new Date().toISOString()}`,
    ].filter(Boolean);

    // Create draft proposal  
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        company_id: companyId,
        property_id: null as any, // Will be filled in later
        title,
        client_name: contactName,
        client_email: email || null,
        lead_source: source,
        notes: noteLines.join("\n"),
        assigned_pm_id: assignedPmId,
        sales_person_id: assignedPmId,
        status: "draft",
      })
      .select("id, proposal_number")
      .single();

    if (proposalError) {
      console.error("Error creating proposal:", proposalError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: proposalError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Lead received: ${contactName} -> Proposal ${proposal.proposal_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        proposal_id: proposal.id,
        proposal_number: proposal.proposal_number,
        message: `Lead captured successfully. Proposal ${proposal.proposal_number} created.`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("receive-lead error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
