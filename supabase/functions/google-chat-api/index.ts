import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Build a JWT from a Google Service Account key and exchange for an access token */
async function getAccessToken(serviceAccountKey: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/chat.messages https://www.googleapis.com/auth/chat.memberships.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${enc(header)}.${enc(payload)}`;

  // Import RSA key
  const pemBody = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsignedToken));
  const sig64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsignedToken}.${sig64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get access token: " + JSON.stringify(tokenData));
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Get service account key
    const saKeyRaw = Deno.env.get("GOOGLE_CHAT_SERVICE_ACCOUNT_KEY");
    if (!saKeyRaw) {
      return new Response(JSON.stringify({ error: "Google Chat service account not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    const saKey = JSON.parse(saKeyRaw);
    const accessToken = await getAccessToken(saKey);

    const { action, ...params } = await req.json();
    const chatApi = "https://chat.googleapis.com/v1";
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

    let result: any;

    switch (action) {
      case "list_spaces": {
        const res = await fetch(`${chatApi}/spaces?pageSize=100`, { headers });
        result = await res.json();
        break;
      }
      case "list_messages": {
        const { spaceId, pageSize = 50, pageToken } = params;
        if (!spaceId) throw new Error("spaceId required");
        let url = `${chatApi}/${spaceId}/messages?pageSize=${pageSize}&orderBy=createTime desc`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        const res = await fetch(url, { headers });
        result = await res.json();
        break;
      }
      case "get_message": {
        const { messageName } = params;
        if (!messageName) throw new Error("messageName required");
        const res = await fetch(`${chatApi}/${messageName}`, { headers });
        result = await res.json();
        break;
      }
      case "send_message": {
        const { spaceId, text, threadKey } = params;
        if (!spaceId || !text) throw new Error("spaceId and text required");
        let url = `${chatApi}/${spaceId}/messages`;
        const body: any = { text };
        if (threadKey) {
          body.thread = { threadKey };
          url += `?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
        }
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        result = await res.json();
        break;
      }
      case "list_members": {
        const { spaceId } = params;
        if (!spaceId) throw new Error("spaceId required");
        const res = await fetch(`${chatApi}/${spaceId}/members?pageSize=100`, { headers });
        result = await res.json();
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("google-chat-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
