import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BEACON_API_URL = Deno.env.get("BEACON_API_URL") || "https://beaconrag.up.railway.app";
const BEACON_API_KEY = Deno.env.get("BEACON_ANALYTICS_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which Beacon endpoint to call from the request body/URL
    const url = new URL(req.url);
    const action = url.searchParams.get("action"); // chat, ingest, knowledge-list, file-content

    // For ingest, check admin role
    if (action === "ingest") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required for ingestion" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let beaconUrl: string;
    let beaconReqInit: RequestInit;

    if (action === "chat") {
      beaconUrl = `${BEACON_API_URL}/api/chat`;
      const body = await req.json();
      beaconReqInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: JSON.stringify(body),
      };
    } else if (action === "ingest") {
      beaconUrl = `${BEACON_API_URL}/api/ingest`;
      const formData = await req.formData();
      beaconReqInit = {
        method: "POST",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: formData,
      };
    } else if (action === "knowledge-list") {
      beaconUrl = `${BEACON_API_URL}/api/knowledge/list`;
      beaconReqInit = {
        method: "GET",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
      };
    } else if (action === "file-content") {
      const sourceFile = url.searchParams.get("source_file") || "";
      beaconUrl = `${BEACON_API_URL}/api/knowledge/file-content?source_file=${encodeURIComponent(sourceFile)}`;
      beaconReqInit = {
        method: "GET",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
      };
    } else if (action === "health") {
      beaconUrl = `${BEACON_API_URL}/`;
      beaconReqInit = { method: "GET" };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const beaconRes = await fetch(beaconUrl, beaconReqInit);
    const responseBody = await beaconRes.text();

    return new Response(responseBody, {
      status: beaconRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": beaconRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    console.error("Beacon proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
