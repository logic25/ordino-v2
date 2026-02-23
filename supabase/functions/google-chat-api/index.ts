// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Refresh the user's Google access token using their refresh_token from gmail_connections */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  supabaseAdmin: any,
  profileId: string
): Promise<string> {
  console.log("Refreshing access token with client_id:", clientId.substring(0, 20) + "...");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokenData = await tokenRes.json();
  console.log("Token refresh response - has access_token:", !!tokenData.access_token, "scope:", tokenData.scope || "none returned");
  
  if (!tokenData.access_token) {
    throw new Error("token_refresh_failed:" + JSON.stringify(tokenData));
  }

  // Update stored access token
  await supabaseAdmin
    .from("gmail_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    })
    .eq("user_id", profileId);

  return tokenData.access_token;
}

/** Resolve a user's display name via People API, with caching */
async function resolveUserName(
  userResourceName: string,
  accessToken: string,
  cache: Map<string, { displayName: string; avatarUrl?: string }>
): Promise<{ displayName: string; avatarUrl?: string } | null> {
  if (cache.has(userResourceName)) return cache.get(userResourceName)!;
  try {
    const peopleId = userResourceName.replace("users/", "");
    const res = await fetch(
      `https://people.googleapis.com/v1/people/${peopleId}?personFields=names,emailAddresses,photos`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const person = await res.json();
      const name = person.names?.[0]?.displayName;
      const email = person.emailAddresses?.[0]?.value;
      const photo = person.photos?.[0]?.url;
      const displayName = name || (email ? email.split("@")[0] : null);
      if (displayName) {
        const entry = { displayName, avatarUrl: photo };
        cache.set(userResourceName, entry);
        return entry;
      }
    }
  } catch (e: any) {
    console.log("resolveUserName failed:", userResourceName, e.message);
  }
  return null;
}

/** Make a Google Chat API call, retrying once with a fresh token on 403 */
async function callChatApi(
  url: string, 
  options: RequestInit, 
  accessToken: string,
  connection: any,
  clientId: string,
  clientSecret: string,
  supabaseAdmin: any,
  profileId: string
): Promise<{ response: Response; retried: boolean }> {
  const headers = { 
    Authorization: `Bearer ${accessToken}`, 
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  
  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 403 || res.status === 401) {
    // Check if it's a scope issue - force refresh and retry
    const body = await res.json();
    console.log("Got", res.status, "- forcing token refresh and retry. Error:", JSON.stringify(body.error || body));
    
    try {
      const newToken = await refreshAccessToken(
        connection.refresh_token, clientId, clientSecret, supabaseAdmin, profileId
      );
      const retryHeaders = { 
        Authorization: `Bearer ${newToken}`, 
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };
      const retryRes = await fetch(url, { ...options, headers: retryHeaders });
      return { response: retryRes, retried: true };
    } catch (refreshErr: any) {
      console.error("Token refresh failed during retry:", refreshErr.message);
      // Return original error response
      return { response: new Response(JSON.stringify(body), { status: res.status }), retried: true };
    }
  }
  
  return { response: res, retried: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Get user's profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });
    }

    // Get user's gmail connection
    const { data: connection } = await supabaseAdmin
      .from("gmail_connections")
      .select("refresh_token, access_token, token_expires_at")
      .eq("user_id", profile.id)
      .single();

    if (!connection?.refresh_token) {
      return new Response(JSON.stringify({ error: "chat_not_connected", message: "Google Chat not connected. Please connect your Google account." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Google OAuth credentials not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Get access token - use cached if valid, otherwise refresh
    let accessToken: string;
    const tokenExpiry = connection.token_expires_at ? new Date(connection.token_expires_at) : new Date(0);
    if (connection.access_token && tokenExpiry > new Date(Date.now() + 60_000)) {
      accessToken = connection.access_token;
    } else {
      accessToken = await refreshAccessToken(connection.refresh_token, clientId, clientSecret, supabaseAdmin, profile.id);
    }

    const { action, ...params } = await req.json();
    const chatApi = "https://chat.googleapis.com/v1";

    let result: any;

    switch (action) {
      case "list_spaces": {
        console.log("list_spaces: calling Google Chat API...");
        const { response, retried } = await callChatApi(
          `${chatApi}/spaces?pageSize=200`, 
          { method: "GET" }, 
          accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id
        );
        const data = await response.json();
        console.log("list_spaces: status", response.status, "retried:", retried, "has error:", !!data.error);
        
        if (data.error) {
          console.error("list_spaces error:", JSON.stringify(data.error));
          if (data.error.code === 403 || data.error.code === 401) {
            return new Response(JSON.stringify({
              error: "chat_scope_missing",
              message: "Your Google account needs to be reconnected with Chat permissions. Please go to Settings > Gmail and reconnect your account.",
            }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        // Enrich DM spaces that have no displayName
        const nameCache = new Map<string, { displayName: string; avatarUrl?: string }>();
        if (data.spaces?.length) {
          const dmSpaces = data.spaces.filter((s: any) =>
            !s.displayName && (s.spaceType === "DIRECT_MESSAGE" || s.type === "DM")
          );
          console.log("list_spaces: enriching", dmSpaces.length, "DM spaces without names");

          for (let i = 0; i < Math.min(dmSpaces.length, 15); i++) {
            const space = dmSpaces[i];
            try {
              const membersRes = await fetch(
                `${chatApi}/${space.name}/members?pageSize=10`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (membersRes.ok) {
                const membersData = await membersRes.json();
                // Debug: log raw membership structure for first DM
                if (i === 0) {
                  console.log("DM members raw sample:", JSON.stringify(membersData.memberships?.slice(0, 2)));
                }
                if (membersData.memberships?.length) {
                  for (const membership of membersData.memberships) {
                    // Chat API uses membership.member for the member object
                    const member = membership.member;
                    if (member && member.type !== "BOT") {
                      if (member.displayName) {
                        space.displayName = member.displayName;
                        console.log("DM enriched via member.displayName:", space.name, "->", member.displayName);
                        break;
                      } else if (member.name) {
                        const resolved = await resolveUserName(member.name, accessToken, nameCache);
                        if (resolved?.displayName) {
                          space.displayName = resolved.displayName;
                          console.log("DM enriched via People API:", space.name, "->", resolved.displayName);
                          break;
                        } else {
                          console.log("DM People API returned no name for:", member.name);
                        }
                      } else {
                        console.log("DM member has no name or displayName:", JSON.stringify(member));
                      }
                    }
                  }
                }
              } else {
                const errBody = await membersRes.text();
                console.log("DM members fetch failed:", membersRes.status, errBody.substring(0, 200));
              }
            } catch (e: any) {
              console.log("DM space enrichment failed:", space.name, e.message);
            }
          }
        }

        result = data;
        break;
      }
      case "list_messages": {
        const { spaceId, pageSize = 50, pageToken } = params;
        if (!spaceId) throw new Error("spaceId required");
        let url = `${chatApi}/${spaceId}/messages?pageSize=${pageSize}&orderBy=createTime desc`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        const { response } = await callChatApi(url, { method: "GET" }, accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id);
        result = await response.json();
        // Enrich senders missing displayName using People API
        if (result.messages?.length) {
          const needEnrichment = new Map<string, any>();
          for (const msg of result.messages) {
            if (msg.sender && !msg.sender.displayName && msg.sender.name && msg.sender.type !== "BOT") {
              needEnrichment.set(msg.sender.name, msg.sender);
            }
          }

          let enrichCount = 0;
          for (const [senderName, _] of needEnrichment) {
            if (enrichCount >= 10) break;
            try {
              const peopleId = senderName.replace("users/", "");
              const peopleUrl = `https://people.googleapis.com/v1/people/${peopleId}?personFields=names,emailAddresses,photos`;
              const peopleRes = await fetch(peopleUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (peopleRes.ok) {
                const person = await peopleRes.json();
                const name = person.names?.[0]?.displayName;
                const email = person.emailAddresses?.[0]?.value;
                const photo = person.photos?.[0]?.url;
                const resolvedName = name || (email ? email.split("@")[0] : null);
                if (resolvedName) {
                  for (const msg of result.messages) {
                    if (msg.sender?.name === senderName) {
                      msg.sender.displayName = resolvedName;
                      if (photo) msg.sender.avatarUrl = photo;
                    }
                  }
                  console.log("Enriched sender:", senderName, "->", resolvedName);
                }
              }
              enrichCount++;
            } catch (e: any) {
              console.log("Sender enrichment failed:", senderName, e.message);
            }
          }
        }
        break;
      }
      case "get_message": {
        const { messageName } = params;
        if (!messageName) throw new Error("messageName required");
        const { response } = await callChatApi(`${chatApi}/${messageName}`, { method: "GET" }, accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id);
        result = await response.json();
        break;
      }
      case "send_message": {
        const { spaceId, text, threadKey } = params;
        if (!spaceId || !text) throw new Error("spaceId and text required");
        let url = `${chatApi}/${spaceId}/messages`;
        if (threadKey) {
          url += `?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
        }
        const body: any = { text };
        if (threadKey) body.thread = { threadKey };
        const { response } = await callChatApi(url, { method: "POST", body: JSON.stringify(body) }, accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id);
        result = await response.json();
        break;
      }
      case "list_members": {
        const { spaceId } = params;
        if (!spaceId) throw new Error("spaceId required");
        const { response } = await callChatApi(`${chatApi}/${spaceId}/members?pageSize=100`, { method: "GET" }, accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id);
        result = await response.json();
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
