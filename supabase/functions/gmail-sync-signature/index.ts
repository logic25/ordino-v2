// Fetches the user's Gmail "Send As" signature and caches it on
// public.gmail_connections.signature_html.  Called on demand from the app
// (Settings -> Resync) and lazily by gmail-send when the cache is stale.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return null;
  return { access_token: data.access_token as string, expires_in: data.expires_in as number };
}

export async function fetchAndCacheSignature(opts: {
  supabaseAdmin: ReturnType<typeof createClient>;
  connectionId: string;
  accessToken: string;
  emailAddress: string;
}): Promise<string | null> {
  const { supabaseAdmin, connectionId, accessToken, emailAddress } = opts;
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    console.warn("gmail-sync-signature: sendAs fetch failed", res.status);
    return null;
  }
  const data = await res.json();
  const sendAs = Array.isArray(data?.sendAs) ? data.sendAs : [];
  // Prefer the default/primary entry that matches the connected address.
  const match =
    sendAs.find((s: any) => s.isPrimary && s.sendAsEmail?.toLowerCase() === emailAddress.toLowerCase()) ||
    sendAs.find((s: any) => s.isDefault) ||
    sendAs.find((s: any) => s.sendAsEmail?.toLowerCase() === emailAddress.toLowerCase()) ||
    sendAs[0];
  const signatureHtml: string = match?.signature || "";
  await supabaseAdmin
    .from("gmail_connections")
    .update({
      signature_html: signatureHtml || null,
      signature_synced_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
  return signatureHtml || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Gmail credentials not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const isServiceRole = token === serviceKey;

    let profileId: string | null = null;
    if (isServiceRole) {
      const body = await req.json().catch(() => ({}));
      profileId = body?.user_id || null;
      if (!profileId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id").eq("user_id", user.id).single();
      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profileId = profile.id;
    }

    const { data: connection } = await supabaseAdmin
      .from("gmail_connections")
      .select("*")
      .eq("user_id", profileId!)
      .single();
    if (!connection) {
      return new Response(JSON.stringify({ error: "Gmail not connected" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = connection.access_token as string;
    const expiry = new Date(connection.token_expires_at || 0);
    if (expiry <= new Date()) {
      const refreshed = await refreshAccessToken(connection.refresh_token!, clientId, clientSecret);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "Token refresh failed" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin.from("gmail_connections").update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq("id", connection.id);
    }

    const sig = await fetchAndCacheSignature({
      supabaseAdmin, connectionId: connection.id, accessToken, emailAddress: connection.email_address,
    });

    return new Response(JSON.stringify({ ok: true, signature_html: sig || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-sync-signature error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
