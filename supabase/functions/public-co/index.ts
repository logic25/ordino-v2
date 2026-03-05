import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 16) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Fetch CO + related data by token
    if (req.method === "GET") {
      const { data: co, error: coErr } = await supabase
        .from("change_orders")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();

      if (coErr) throw coErr;
      if (!co) {
        return new Response(JSON.stringify({ error: "Change order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch company info
      let company = null;
      if (co.company_id) {
        const { data } = await supabase
          .from("companies")
          .select("name, address, phone, email, website, logo_url, settings")
          .eq("id", co.company_id)
          .maybeSingle();
        if (data) {
          const s = (data.settings || {}) as any;
          company = {
            name: data.name,
            address: s.company_address?.trim() || data.address || "",
            phone: s.company_phone?.trim() || data.phone || "",
            email: s.company_email?.trim() || data.email || "",
            logo_url: s.company_logo_url?.trim() || data.logo_url || "",
          };
        }
      }

      // Fetch project + client info
      let project = null;
      if (co.project_id) {
        const { data } = await supabase
          .from("projects")
          .select("project_number, property_id, properties(address, borough), client_id, clients!projects_client_id_fkey(name)")
          .eq("id", co.project_id)
          .maybeSingle();
        project = data;
      }

      return new Response(JSON.stringify({ co, company, project }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Sign or update deposit
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      // Verify token matches a real CO first
      const { data: existing } = await supabase
        .from("change_orders")
        .select("id, status, client_signed_at, deposit_paid_at, deposit_percentage")
        .eq("public_token", token)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Change order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "sign") {
        if (existing.client_signed_at) {
          return new Response(JSON.stringify({ error: "Already signed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { client_signature_data, client_signer_name } = body;
        if (!client_signature_data || !client_signer_name) {
          return new Response(JSON.stringify({ error: "Missing signature data or name" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("change_orders")
          .update({
            client_signature_data,
            client_signer_name,
            client_signed_at: new Date().toISOString(),
            status: "approved",
            approved_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "deposit") {
        if (existing.deposit_paid_at) {
          return new Response(JSON.stringify({ error: "Deposit already paid" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("change_orders")
          .update({ deposit_paid_at: new Date().toISOString() })
          .eq("id", existing.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
