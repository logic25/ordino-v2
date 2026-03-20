import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting: max 5 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
        .select("id, status, client_signed_at, deposit_paid_at, deposit_percentage, amount, company_id, project_id, co_number, title")
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

        // Create billing request for approved CO
        if (existing.amount > 0) {
          try {
            await supabase.from("billing_requests").insert({
              company_id: existing.company_id,
              project_id: existing.project_id,
              services: [{ name: existing.title, quantity: 1, rate: existing.amount, amount: existing.amount }],
              total_amount: existing.amount,
              status: "pending",
            });
          } catch (brErr) {
            console.error("Error creating billing request for CO:", brErr);
          }
        }

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

        const depositPct = existing.deposit_percentage || 0;
        const depositAmount = Math.round(existing.amount * depositPct) / 100;
        const { payment_method } = body;

        // Update CO timestamp
        const { error } = await supabase
          .from("change_orders")
          .update({ deposit_paid_at: new Date().toISOString() })
          .eq("id", existing.id);

        if (error) throw error;

        // Get project's client_id
        let clientId: string | null = null;
        if (existing.project_id) {
          const { data: proj } = await supabase
            .from("projects")
            .select("client_id")
            .eq("id", existing.project_id)
            .maybeSingle();
          clientId = proj?.client_id || null;
        }

        // Create client_retainers record
        if (depositAmount > 0 && clientId) {
          try {
            const { data: retainer } = await supabase
              .from("client_retainers")
              .insert({
                company_id: existing.company_id,
                client_id: clientId,
                project_id: existing.project_id,
                initial_amount: depositAmount,
                current_balance: depositAmount,
                source: `CO ${existing.co_number} deposit`,
              } as any)
              .select("id")
              .single();

            if (retainer) {
              await supabase.from("retainer_transactions").insert({
                company_id: existing.company_id,
                retainer_id: retainer.id,
                type: "deposit",
                amount: depositAmount,
                description: `Deposit for Change Order ${existing.co_number}`,
              } as any);
            }
          } catch (retErr) {
            console.error("Error creating retainer for CO deposit:", retErr);
          }
        }

        // Create paid invoice for the deposit
        if (depositAmount > 0) {
          try {
            await supabase.from("invoices").insert({
              company_id: existing.company_id,
              project_id: existing.project_id,
              client_id: clientId,
              line_items: [{ description: `Deposit — ${existing.co_number}: ${existing.title}`, quantity: 1, rate: depositAmount, amount: depositAmount }],
              subtotal: depositAmount,
              total_due: depositAmount,
              status: "paid",
              payment_amount: depositAmount,
              payment_method: payment_method || "check",
              payment_date: new Date().toISOString().split("T")[0],
              paid_at: new Date().toISOString(),
            } as any);
          } catch (invErr) {
            console.error("Error creating deposit invoice for CO:", invErr);
          }
        }

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
