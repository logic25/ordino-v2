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
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

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
      // Explicit client-facing columns only — never expose public_token, signed_ip,
      // signed_user_agent, internal_signed_by UUID, or other internal audit fields.
      const PUBLIC_CO_COLUMNS = [
        "id", "co_number", "title", "description", "reason", "requested_by",
        "amount", "status", "line_items", "linked_service_names",
        "deposit_percentage", "deposit_paid_at",
        "client_signed_at", "client_signer_name", "client_signature_data",
        "internal_signed_at", "internal_signer_name", "internal_signature_data",
        "sent_to_email", "public_token_expires_at",
        "company_id", "project_id", "created_at",
      ].join(",");

      const { data: co, error: coErr } = await supabase
        .from("change_orders")
        .select(PUBLIC_CO_COLUMNS)
        .eq("public_token", token)
        .maybeSingle();


      if (coErr) throw coErr;
      if (!co) {
        return new Response(JSON.stringify({ error: "Change order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Token expiry guard — only blocks if not yet signed
      const exp = (co as any).public_token_expires_at;
      if (!co.client_signed_at && exp && new Date(exp).getTime() < Date.now()) {
        return new Response(JSON.stringify({
          error: "Link expired",
          expired: true,
          co_number: co.co_number,
        }), {
          status: 410,
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

      // Fetch contract summary: original contract total + prior approved COs
      let contractSummary = null;
      if (co.project_id) {
        const { data: services } = await supabase
          .from("services")
          .select("total_amount, change_order_id")
          .eq("project_id", co.project_id);
        const originalTotal = (services || [])
          .filter((s: any) => !s.change_order_id)
          .reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);

        const { data: approvedCOs } = await supabase
          .from("change_orders")
          .select("id, amount")
          .eq("project_id", co.project_id)
          .eq("status", "approved")
          .neq("id", co.id);
        const priorCOsTotal = (approvedCOs || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
        const priorCOsCount = (approvedCOs || []).length;

        contractSummary = { originalTotal, priorCOsTotal, priorCOsCount };
      }

      return new Response(JSON.stringify({ co, company, project, contractSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Sign or pay deposit — all writes happen inside SECURITY DEFINER RPCs.
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;
      const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;

      if (action === "sign") {
        const { client_signature_data, client_signer_name, document_hash } = body;
        if (!client_signature_data || !client_signer_name) {
          return new Response(JSON.stringify({ error: "Missing signature data or name" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase.rpc("sign_change_order", {
          _token: token,
          _signer_name: client_signer_name,
          _signature_data: client_signature_data,
          _signer_ip: clientIp,
          _signer_user_agent: userAgent,
          _document_hash: document_hash || null,
        });
        if (error) throw error;
        const result = data as any;
        if (!result?.success) {
          const status = result?.error === "Link expired" ? 410
            : result?.error === "Not found" ? 404
            : 400;
          return new Response(JSON.stringify({ error: result?.error || "Sign failed" }), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "deposit") {
        const { payment_method } = body;
        const { data, error } = await supabase.rpc("pay_co_deposit", {
          _token: token,
          _payment_method: payment_method || "check",
        });
        if (error) throw error;
        const result = data as any;
        if (!result?.success) {
          return new Response(JSON.stringify({ error: result?.error || "Deposit failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true, deposit_amount: result.deposit_amount }), {
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
    console.error("public-co error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
