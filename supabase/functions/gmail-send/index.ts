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

interface Attachment {
  filename: string;
  content: string; // base64
  mime_type: string;
}

function createMimeMessage({
  to,
  cc,
  bcc,
  from,
  subject,
  body,
  in_reply_to,
  references,
  attachments,
}: {
  to: string;
  cc?: string;
  bcc?: string;
  from: string;
  subject: string;
  body: string;
  in_reply_to?: string;
  references?: string;
  attachments?: Attachment[];
}): string {
  const hasAttachments = attachments && attachments.length > 0;
  const boundary = "boundary_" + Date.now();
  const altBoundary = "alt_boundary_" + Date.now();

  let headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
  ];

  if (cc) headers.splice(1, 0, `Cc: ${cc}`);
  if (bcc) headers.splice(cc ? 2 : 1, 0, `Bcc: ${bcc}`);
  if (in_reply_to) headers.push(`In-Reply-To: ${in_reply_to}`);
  if (references) headers.push(`References: ${references}`);

  const plainBody = body.replace(/<[^>]*>/g, "");

  if (!hasAttachments) {
    // Simple multipart/alternative
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const message = [
      ...headers,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      plainBody,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      body,
      `--${boundary}--`,
    ].join("\r\n");

    return btoa(unescape(encodeURIComponent(message)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // multipart/mixed with nested multipart/alternative for body
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts = [
    ...headers,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainBody,
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    body,
    `--${altBoundary}--`,
  ];

  for (const att of attachments!) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mime_type}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      att.content
    );
  }

  parts.push(`--${boundary}--`);

  const message = parts.join("\r\n");
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
        JSON.stringify({ error: "Gmail credentials not configured" }),
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

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const reqBody = await req.json();
    const { to, cc, bcc, subject, html_body, reply_to_email_id, attachments } = reqBody;

    if (!to || !subject || !html_body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html_body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connection
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

    // Refresh token if needed
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
          token_expires_at: new Date(
            Date.now() + refreshed.expires_in * 1000
          ).toISOString(),
        })
        .eq("id", connection.id);
    }

    // Build reply context if replying
    let in_reply_to: string | undefined;
    let references: string | undefined;
    let threadId: string | undefined;

    if (reply_to_email_id) {
      const { data: originalEmail } = await supabaseAdmin
        .from("emails")
        .select("gmail_message_id, thread_id")
        .eq("id", reply_to_email_id)
        .single();

      if (originalEmail) {
        threadId = originalEmail.thread_id || undefined;

        const msgRes = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${originalEmail.gmail_message_id}?format=metadata&metadataHeaders=Message-ID`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();
        const messageIdHeader = msgData.payload?.headers?.find(
          (h: any) => h.name?.toLowerCase() === "message-id"
        );
        if (messageIdHeader) {
          in_reply_to = messageIdHeader.value;
          references = messageIdHeader.value;
        }
      }
    }

    // Create and send the email
    const raw = createMimeMessage({
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      from: connection.email_address,
      subject,
      body: html_body,
      in_reply_to,
      references,
      attachments: attachments || undefined,
    });

    const sendBody: any = { raw };
    if (threadId) {
      sendBody.threadId = threadId;
    }

    const sendRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendBody),
      }
    );

    const sendData = await sendRes.json();
    if (sendData.error) {
      return new Response(
        JSON.stringify({ error: sendData.error.message || "Send failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: sendData.id,
        thread_id: sendData.threadId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Send error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
