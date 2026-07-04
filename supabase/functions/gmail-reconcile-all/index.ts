// Admin-only: loops every gmail_connection in the caller's company and runs
// the read-state + INBOX-label reconciliation against Gmail. Does NOT pull new
// messages — use this when local badges/inbox counts drift from Gmail.
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

async function listAllIds(accessToken: string, q: string, maxPages = 20): Promise<Set<string>> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let pages = 0;
  while (pages < maxPages) {
    const u = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
    u.searchParams.set("maxResults", "500");
    u.searchParams.set("q", q);
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = await r.json();
    for (const m of j.messages || []) ids.add(m.id);
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
    pages++;
  }
  return ids;
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID")!;
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin guard via user_roles
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, company_id").eq("user_id", user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: connections } = await supabaseAdmin
      .from("gmail_connections")
      .select("id, user_id, access_token, refresh_token, token_expires_at, email_address");

    // Restrict to connections owned by company users
    const { data: companyProfiles } = await supabaseAdmin
      .from("profiles").select("id").eq("company_id", profile.company_id);
    const companyProfileIds = new Set((companyProfiles || []).map((p: any) => p.id));
    const targets = (connections || []).filter((c: any) => companyProfileIds.has(c.user_id));

    const results: any[] = [];
    for (const conn of targets) {
      try {
        let accessToken = conn.access_token as string;
        const expiry = new Date(conn.token_expires_at || 0);
        if (expiry <= new Date()) {
          const refreshed = await refreshAccessToken(conn.refresh_token, gmailClientId, gmailClientSecret);
          if (!refreshed) {
            results.push({ email: conn.email_address, error: "token refresh failed" });
            continue;
          }
          accessToken = refreshed.access_token;
          await supabaseAdmin.from("gmail_connections").update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          }).eq("id", conn.id);
        }

        // 1) Unread reconciliation
        const unreadSet = await listAllIds(accessToken, "is:unread in:inbox", 10);
        const { data: localUnread } = await supabaseAdmin
          .from("emails").select("id, gmail_message_id")
          .eq("user_id", conn.user_id).eq("is_read", false)
          .not("gmail_message_id", "is", null);
        const toMarkRead = (localUnread || [])
          .filter((r: any) => !unreadSet.has(r.gmail_message_id))
          .map((r: any) => r.id);
        for (const ids of chunk(toMarkRead, 200)) {
          await supabaseAdmin.from("emails").update({ is_read: true }).in("id", ids);
        }

        // 2) INBOX label drift
        const inboxSet = await listAllIds(accessToken, "in:inbox", 20);
        const { data: localInbox } = await supabaseAdmin
          .from("emails").select("id, gmail_message_id, labels")
          .eq("user_id", conn.user_id)
          .filter("labels", "cs", '["INBOX"]')
          .is("archived_at", null)
          .not("gmail_message_id", "is", null);
        const toStrip = (localInbox || [])
          .filter((r: any) => !inboxSet.has(r.gmail_message_id))
          .map((r: any) => ({
            id: r.id,
            labels: Array.isArray(r.labels) ? (r.labels as string[]).filter((l) => l !== "INBOX") : [],
          }));
        const nowIso = new Date().toISOString();
        for (const group of chunk(toStrip, 50)) {
          await Promise.all(group.map((row) =>
            supabaseAdmin.from("emails")
              .update({ labels: row.labels, archived_at: nowIso }).eq("id", row.id),
          ));
        }

        results.push({
          email: conn.email_address,
          gmail_unread_inbox: unreadSet.size,
          gmail_inbox_total: inboxSet.size,
          marked_read: toMarkRead.length,
          stripped_inbox: toStrip.length,
        });
      } catch (e: any) {
        results.push({ email: conn.email_address, error: e.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
