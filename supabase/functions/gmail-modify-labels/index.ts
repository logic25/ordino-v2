// Push UNREAD/INBOX/STAR label changes from Ordino back to Gmail so the two
// systems never drift. Called by useMarkReadUnread (and future archive/star).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const emailId = String(body.email_id || "");
    const addLabelIds: string[] = Array.isArray(body.add) ? body.add : [];
    const removeLabelIds: string[] = Array.isArray(body.remove) ? body.remove : [];
    if (!emailId || (addLabelIds.length === 0 && removeLabelIds.length === 0)) {
      return new Response(JSON.stringify({ error: "email_id and add/remove required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve profile + load email (RLS-scoped via service role, then ownership check)
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, company_id").eq("user_id", user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("id, user_id, company_id, gmail_message_id, labels")
      .eq("id", emailId)
      .single();
    if (!email || email.company_id !== profile.company_id) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email.gmail_message_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_gmail_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connection belongs to the row's owner (profile.id stored in emails.user_id)
    const { data: conn } = await supabaseAdmin
      .from("gmail_connections")
      .select("id, access_token, refresh_token, token_expires_at")
      .eq("user_id", email.user_id)
      .maybeSingle();
    if (!conn) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_connection" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = conn.access_token as string;
    const expiry = new Date(conn.token_expires_at || 0);
    if (expiry <= new Date()) {
      const refreshed = await refreshAccessToken(
        conn.refresh_token as string,
        Deno.env.get("GMAIL_CLIENT_ID")!,
        Deno.env.get("GMAIL_CLIENT_SECRET")!,
      );
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "token_refresh_failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin.from("gmail_connections").update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq("id", conn.id);
    }

    const r = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${email.gmail_message_id}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      },
    );
    if (!r.ok) {
      const text = await r.text();
      console.error("[gmail-modify-labels] gmail error", r.status, text);
      return new Response(JSON.stringify({ error: "gmail_modify_failed", status: r.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mirror the label change locally so subsequent lists/counts are consistent.
    const current: string[] = Array.isArray(email.labels) ? (email.labels as string[]) : [];
    const next = Array.from(
      new Set(current.filter((l) => !removeLabelIds.includes(l)).concat(addLabelIds)),
    );
    await supabaseAdmin.from("emails").update({ labels: next }).eq("id", email.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[gmail-modify-labels] error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
