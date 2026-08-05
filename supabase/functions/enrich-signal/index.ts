import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BEACON_API_URL = Deno.env.get("BEACON_API_URL") || "https://beaconrag.up.railway.app";
const BEACON_API_KEY = Deno.env.get("BEACON_ANALYTICS_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "text required" }, 400);
  if (text.length > 20000) return json({ error: "text too long" }, 400);

  if (!BEACON_API_KEY) return json({ error: "Beacon not configured" }, 500);

  try {
    const res = await fetch(`${BEACON_API_URL}/api/enrich-signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Beacon-Key": BEACON_API_KEY,
        // Lets Beacon run "who do we know" against this user's visibility.
        "x-ordino-user-authorization": authHeader,
      },
      body: JSON.stringify({ text }),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error("enrich-signal upstream error", res.status, raw.slice(0, 500));
      return json({ error: `Beacon error ${res.status}`, detail: raw.slice(0, 500) }, 502);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid response from Beacon", warning: raw.slice(0, 200) }, 502);
    }
    const leads = Array.isArray(parsed?.leads) ? parsed.leads : [];
    return json({
      lead_count: parsed?.lead_count ?? leads.length,
      leads,
      story: typeof parsed?.story === "string" ? parsed.story : "",
    });
  } catch (e: any) {
    console.error("enrich-signal failed", e);
    return json({ error: e?.message ?? "Request failed" }, 500);
  }
});
