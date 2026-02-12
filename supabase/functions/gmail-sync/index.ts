import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
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
  return { access_token: data.access_token, expires_in: data.expires_in };
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function extractEmailParts(payload: any): {
  body_text: string;
  body_html: string;
  attachments: any[];
} {
  let body_text = "";
  let body_html = "";
  const attachments: any[] = [];

  function walk(part: any) {
    if (!part) return;
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        filename: part.filename,
        mime_type: part.mimeType,
        size_bytes: part.body?.size || 0,
        gmail_attachment_id: part.body?.attachmentId || null,
      });
      return;
    }

    if (part.mimeType === "text/plain" && part.body?.data) {
      body_text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      body_html = decodeBase64Url(part.body.data);
    }

    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return { body_text, body_html, attachments };
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

    if (!gmailClientId || !gmailClientSecret) {
      return new Response(
        JSON.stringify({ error: "Gmail credentials not configured", setup_required: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile and gmail connection
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: connection } = await supabaseAdmin
      .from("gmail_connections")
      .select("*")
      .eq("user_id", profile.id)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ error: "Gmail not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    const tokenExpiry = new Date(connection.token_expires_at || 0);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(
        connection.refresh_token!,
        gmailClientId,
        gmailClientSecret
      );
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "Token refresh failed" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from("gmail_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
    }

    // Fetch message list (last 50)
    const listRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      await supabaseAdmin
        .from("gmail_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ synced: 0, message: "No messages found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let syncedCount = 0;

    // Process each message
    for (const msg of listData.messages) {
      // Check if already synced
      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("gmail_message_id", msg.id)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (existing) continue;

      // Fetch full message
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgRes.json();

      if (!msgData.payload) {
        console.error("No payload for message:", msg.id, JSON.stringify(msgData).substring(0, 500));
        continue;
      }

      const headers = msgData.payload?.headers || [];
      if (headers.length === 0) {
        console.error("No headers for message:", msg.id, "payload keys:", Object.keys(msgData.payload), "payload.headers:", msgData.payload?.headers);
      }
      const fromRaw = getHeader(headers, "From");
      const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
      const from_name = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromRaw;
      const from_email = fromMatch ? fromMatch[2] : fromRaw;

      const toRaw = getHeader(headers, "To");
      const to_emails = toRaw
        .split(",")
        .map((e: string) => e.trim())
        .filter(Boolean);

      const { body_text, body_html, attachments } = extractEmailParts(msgData.payload);

      const dateStr = getHeader(headers, "Date");
      let emailDate: string | null = null;
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          emailDate = parsed.toISOString();
        } else {
          emailDate = new Date(parseInt(msgData.internalDate)).toISOString();
        }
      } catch {
        try {
          emailDate = new Date(parseInt(msgData.internalDate)).toISOString();
        } catch {
          emailDate = new Date().toISOString();
        }
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("emails")
        .insert({
          company_id: profile.company_id,
          user_id: profile.id,
          gmail_message_id: msg.id,
          thread_id: msg.threadId,
          subject: getHeader(headers, "Subject") || "(no subject)",
          from_email,
          from_name,
          to_emails,
          date: emailDate,
          body_text,
          body_html,
          snippet: msgData.snippet || "",
          has_attachments: attachments.length > 0,
          labels: msgData.labelIds || [],
          is_read: !(msgData.labelIds || []).includes("UNREAD"),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        continue;
      }

      // Insert attachments
      if (attachments.length > 0 && inserted) {
        const attachmentRows = attachments.map((a: any) => ({
          email_id: inserted.id,
          company_id: profile.company_id,
          filename: a.filename,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          gmail_attachment_id: a.gmail_attachment_id,
        }));

        await supabaseAdmin.from("email_attachments").insert(attachmentRows);
      }

      syncedCount++;
    }

    // Update last sync
    await supabaseAdmin
      .from("gmail_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({ synced: syncedCount, total_checked: listData.messages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
