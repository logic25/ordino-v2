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
      return { response: new Response(JSON.stringify(body), { status: res.status }), retried: true };
    }
  }
  
  return { response: res, retried: false };
}

/**
 * Enrich unnamed spaces with member-derived display names.
 * Uses Chat API membership displayName directly (no People API calls).
 * currentUserDisplayName comes from the profiles table for reliable isMe matching.
 */
async function enrichSpaceNames(
  spaces: any[],
  accessToken: string,
  chatApi: string,
  currentUserDisplayName: string | null
) {
  console.log("enrichSpaceNames: currentUserDisplayName from profile:", currentUserDisplayName);

  function isMe(memberDisplayName: string): boolean {
    if (!currentUserDisplayName || !memberDisplayName) return false;
    return memberDisplayName.toLowerCase().trim() === currentUserDisplayName.toLowerCase().trim();
  }

  const unnamedSpaces = spaces.filter((s: any) => !s.displayName);
  console.log("enrichSpaceNames: enriching", unnamedSpaces.length, "unnamed spaces");

  const enrichBatch = unnamedSpaces.slice(0, 100);
  let debugLoggedFirst = false;
  const enrichResults = await Promise.allSettled(
    enrichBatch.map(async (space: any) => {
      const membersRes = await fetch(
        `${chatApi}/${space.name}/members?pageSize=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!membersRes.ok) {
        const errText = await membersRes.text();
        console.log("enrichSpaceNames: members fetch FAILED for", space.name, "status:", membersRes.status, "body:", errText.substring(0, 200));
        return;
      }
      const membersData = await membersRes.json();
      if (!debugLoggedFirst) {
        debugLoggedFirst = true;
        console.log("enrichSpaceNames: SAMPLE membership response for", space.name, ":", JSON.stringify(membersData).substring(0, 500));
      }
      if (!membersData.memberships?.length) {
        console.log("enrichSpaceNames: no memberships for", space.name);
        return;
      }

      const isDM = space.spaceType === "DIRECT_MESSAGE" || space.type === "DM" || space.type === "DIRECT_MESSAGE";

      // Separate human and bot members, using displayName directly from Chat API
      const humans: { displayName: string; isMe: boolean }[] = [];
      const bots: { displayName: string }[] = [];

      for (const membership of membersData.memberships) {
        const member = membership.member;
        if (!member) continue;
        
        // Chat API membership response includes member.displayName for all member types
        const name = member.displayName || "";
        
        if (member.type === "BOT") {
          bots.push({ displayName: name || "Bot" });
        } else if (name) {
          humans.push({ displayName: name, isMe: isMe(name) });
        }
      }

      if (isDM) {
        // For 1:1 DMs, show the OTHER person's name
        if (humans.length >= 2) {
          const other = humans.find(h => !h.isMe);
          if (other) {
            space.displayName = other.displayName;
          } else {
            // Couldn't determine who's "me" — pick the second member
            space.displayName = humans[1].displayName;
          }
        } else if (humans.length === 1 && bots.length >= 1) {
          // Human + bot DM — show bot name (e.g. Beacon, Google Drive)
          space.displayName = bots[0].displayName;
        } else if (humans.length === 1) {
          const h = humans[0];
          if (!h.isMe) {
            space.displayName = h.displayName;
          } else if (bots.length > 0) {
            space.displayName = bots[0].displayName;
          }
        } else if (bots.length >= 1) {
          // Bot-only DM
          space.displayName = bots[0].displayName;
        }
      } else {
        // GROUP: build name from OTHER members' first names
        const memberNames: string[] = [];
        for (const h of humans) {
          if (h.isMe) continue;
          memberNames.push(h.displayName.split(" ")[0]);
          if (memberNames.length >= 4) break;
        }
        if (memberNames.length > 0) {
          space.displayName = memberNames.join(", ");
        }
      }
    })
  );
  const resolved = enrichResults.filter(r => r.status === "fulfilled").length;
  const failed = enrichResults.filter(r => r.status === "rejected").length;
  
  // Log what names were actually set
  const enrichedNames = unnamedSpaces.filter((s: any) => s.displayName).map((s: any) => `${s.name}=${s.displayName}`);
  const stillUnnamed = unnamedSpaces.filter((s: any) => !s.displayName).length;
  console.log("Parallel enrichment done:", resolved, "resolved,", failed, "failed.", enrichedNames.length, "names set,", stillUnnamed, "still unnamed");
  if (enrichedNames.length > 0) {
    console.log("enrichSpaceNames: sample names:", enrichedNames.slice(0, 5).join(", "));
  }

  // FINAL FALLBACK: Never show raw space IDs to the user
  for (const space of spaces) {
    if (!space.displayName) {
      if (space.singleUserBotDm) {
        space.displayName = "Bot";
      } else if (space.spaceType === "DIRECT_MESSAGE" || space.type === "DM" || space.type === "DIRECT_MESSAGE") {
        space.displayName = "Direct Message";
      } else if (space.spaceType === "GROUP_CHAT" || space.type === "GROUP_CHAT") {
        space.displayName = "Group Chat";
      } else {
        space.displayName = "Unknown Space";
      }
    }
  }
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

    // Get user's profile — include display_name for identity matching
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id, display_name")
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
        const requestedPageSize = params.pageSize || 25;
        const requestedPageToken = params.pageToken || null;

        // --- Server-side cache: check for fresh cached data ---
        const cacheKey = `spaces_${profile.id}_ps${requestedPageSize}_pt${requestedPageToken || "first"}`;
        const { data: cached } = await supabaseAdmin
          .from("gchat_spaces_cache")
          .select("payload, cached_at")
          .eq("user_id", profile.id)
          .eq("cache_key", cacheKey)
          .maybeSingle();

        if (cached?.cached_at) {
          const age = Date.now() - new Date(cached.cached_at).getTime();
          if (age < 5 * 60 * 1000) {
            console.log("list_spaces: serving from cache (age:", Math.round(age / 1000), "s)");
            result = cached.payload;
            break;
          }
        }

        console.log("list_spaces: calling Google Chat API, pageSize:", requestedPageSize);
        const url = `${chatApi}/spaces?pageSize=${requestedPageSize}${requestedPageToken ? `&pageToken=${requestedPageToken}` : ""}`;
        const { response, retried } = await callChatApi(
          url,
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
              message: "Your Google account needs to be reconnected with Chat permissions.",
            }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        // Enrich space names — pass profile display_name for isMe matching
        if (data.spaces?.length) {
          await enrichSpaceNames(data.spaces, accessToken, chatApi, profile.display_name || null);

          // Sort by lastActiveTime
          data.spaces.sort((a: any, b: any) => {
            const aTime = a.lastActiveTime || a.createTime || '';
            const bTime = b.lastActiveTime || b.createTime || '';
            return bTime.localeCompare(aTime);
          });
        }

        result = { spaces: data.spaces || [], nextPageToken: data.nextPageToken || null };

        // Cache the result
        await supabaseAdmin
          .from("gchat_spaces_cache")
          .upsert({
            user_id: profile.id,
            cache_key: cacheKey,
            payload: result,
            cached_at: new Date().toISOString(),
          }, { onConflict: "user_id,cache_key" })
          .then(() => {});

        break;
      }
      case "list_messages": {
        const { spaceId, pageSize = 50, pageToken } = params;
        if (!spaceId) throw new Error("spaceId required");
        let url = `${chatApi}/${spaceId}/messages?pageSize=${pageSize}&orderBy=createTime desc`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        const { response } = await callChatApi(url, { method: "GET" }, accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id);
        result = await response.json();
        
        // Enrich senders — resolve both human and bot names from membership data
        if (result.messages?.length) {
          const memberMap = new Map<string, { displayName: string; avatarUrl?: string }>();
          
          // Fetch space members to build a name lookup (includes bots)
          try {
            const membersRes = await fetch(
              `${chatApi}/${spaceId}/members?pageSize=100`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (membersRes.ok) {
              const membersData = await membersRes.json();
              for (const membership of (membersData.memberships || [])) {
                const member = membership.member;
                if (member?.name && member?.displayName) {
                  memberMap.set(member.name, { displayName: member.displayName, avatarUrl: undefined });
                }
              }
            } else {
              await membersRes.text();
            }
          } catch {
            // non-critical
          }

          // Apply member names to ALL messages (both human and bot senders)
          for (const msg of result.messages) {
            if (msg.sender?.name) {
              const known = memberMap.get(msg.sender.name);
              if (known?.displayName) {
                // Always set displayName from membership if available
                if (!msg.sender.displayName) {
                  msg.sender.displayName = known.displayName;
                }
                if (known.avatarUrl && !msg.sender.avatarUrl) {
                  msg.sender.avatarUrl = known.avatarUrl;
                }
              }
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
      case "search_people": {
        const { query } = params;
        if (!query) throw new Error("query required");
        const peopleUrl = `https://people.googleapis.com/v1/people:searchDirectoryPeople?query=${encodeURIComponent(query)}&readMask=names,emailAddresses,photos&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE&pageSize=10`;
        console.log("search_people: querying for", query);
        const { response: peopleRes } = await callChatApi(
          peopleUrl, { method: "GET" }, accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id
        );
        const peopleData = await peopleRes.json();
        console.log("search_people: status", peopleRes.status, "found", peopleData.people?.length || 0, "people");
        if (peopleData.error) {
          console.error("search_people error:", JSON.stringify(peopleData.error));
        }
        result = peopleData;
        break;
      }
      case "create_dm": {
        const { userEmail } = params;
        if (!userEmail) throw new Error("userEmail required");
        const { response } = await callChatApi(
          `${chatApi}/spaces:setup`,
          {
            method: "POST",
            body: JSON.stringify({
              spaceType: "DIRECT_MESSAGE",
              memberships: [
                { member: { name: `users/${userEmail}`, type: "HUMAN" } },
              ],
            }),
          },
          accessToken, connection, clientId, clientSecret, supabaseAdmin, profile.id
        );
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
