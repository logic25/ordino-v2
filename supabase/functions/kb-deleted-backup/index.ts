import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-beacon-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Receives a deleted KB doc's content from Beacon (just before it removes the chunks
// from Pinecone) and stores it so a wrongful/accidental delete is restorable.
// Server-to-server only: gated by the same shared secret beacon uses elsewhere.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const expectedKey = Deno.env.get("BEACON_ANALYTICS_KEY") ?? "";
  const providedKey = req.headers.get("x-beacon-key") ?? "";
  if (!expectedKey || providedKey !== expectedKey) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const source_file = (payload?.source_file ?? "").toString().trim();
  if (!source_file) return json({ ok: false, error: "source_file required" }, 400);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await sb.from("kb_deleted_documents").insert({
    source_file,
    content: payload?.content ?? null,
  });
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true });
});
