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

  // RFC 2047 encode subject for non-ASCII characters
  const encodedSubject = /[^\x20-\x7E]/.test(subject)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
    : subject;

  let headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
  ];

  if (cc) headers.splice(1, 0, `Cc: ${cc}`);
  if (bcc) headers.splice(cc ? 2 : 1, 0, `Bcc: ${bcc}`);
  if (in_reply_to) headers.push(`In-Reply-To: ${in_reply_to}`);
  if (references) headers.push(`References: ${references}`);

  const plainBody = body.replace(/<[^>]*>/g, "");

  // Helper: wrap base64 at 76 chars per line (RFC 2045)
  function wrapBase64(b64: string): string {
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.substring(i, i + 76));
    }
    return lines.join("\r\n");
  }

  // Helper: URL-safe base64 encode for Gmail API
  function toWebSafeBase64(str: string): string {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

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

    return toWebSafeBase64(message);
  }

  // multipart/mixed with nested multipart/alternative for body
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  // Build text portion of the message (headers + body parts)
  const textParts = [
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
  ].join("\r\n");

  // Build attachment parts with proper base64 line wrapping
  const attachmentParts: string[] = [];
  for (const att of attachments!) {
    // RFC 2047 encode filename for non-ASCII characters
    const safeFilename = /[^\x20-\x7E]/.test(att.filename)
      ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(att.filename)))}?=`
      : att.filename;
    attachmentParts.push(
      `\r\n--${boundary}`,
      `Content-Type: ${att.mime_type}; name="${safeFilename}"`,
      `Content-Disposition: attachment; filename="${safeFilename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(att.content),
    );
  }

  const fullMessage = textParts + attachmentParts.join("\r\n") + `\r\n--${boundary}--`;

  // For messages with binary attachments, encode using Uint8Array to avoid
  // charset issues with the encodeURIComponent/unescape approach
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(fullMessage);
  // Convert Uint8Array to binary string for btoa
  let binaryStr = "";
  for (let i = 0; i < messageBytes.length; i++) {
    binaryStr += String.fromCharCode(messageBytes[i]);
  }
  return btoa(binaryStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("gmail-send invoked", { method: req.method, url: req.url });
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

    // Check if this is a service-role call (from other edge functions)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;

    let profileId: string;

    if (isServiceRole) {
      // Service-role call: read body first to get user_id
      const reqBody = await req.json();
      const { to, cc, bcc, subject, html_body, reply_to_email_id, attachments, user_id: bodyUserId } = reqBody;

      if (!bodyUserId) {
        return new Response(JSON.stringify({ error: "user_id required for service-role calls" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // bodyUserId is the profiles.id (not auth user id)
      profileId = bodyUserId;

      // Store parsed body for later use
      (req as any)._parsedBody = { to, cc, bcc, subject, html_body, reply_to_email_id, attachments };
    } else {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await supabaseUser.auth.getUser();
      if (userError) {
        console.error("getUser error:", userError.message, userError.status);
      }
      if (!user) {
        console.error("getUser returned null user. Auth header present:", !!authHeader, "Token prefix:", authHeader?.substring(0, 20));
        return new Response(JSON.stringify({ error: "Unauthorized", detail: userError?.message || "getUser returned null" }), {
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

      profileId = profile.id;
    }

    const reqBody = isServiceRole ? (req as any)._parsedBody : await req.json();
    const { to, cc, bcc, subject, html_body, reply_to_email_id, attachments, project_id, tag_category } = reqBody;

    if (!to || !subject || !html_body) {
      console.error("Missing required fields", { to: !!to, subject: !!subject, html_body: !!html_body });
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html_body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connection
    const { data: connection } = await supabaseAdmin
      .from("gmail_connections")
      .select("*")
      .eq("user_id", profileId)
      .single();

    if (!connection) {
      console.error("Gmail not connected for profile:", profileId);
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
        console.error("Token refresh failed for connection:", connection.id, "profile:", profileId);
        return new Response(JSON.stringify({ error: "Token refresh failed — please reconnect Gmail" }), {
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

    // Log attachment info for debugging
    if (attachments && attachments.length > 0) {
      console.log(`gmail-send: ${attachments.length} attachment(s) included:`,
        attachments.map((a: any) => ({ filename: a.filename, mime_type: a.mime_type, size_bytes: Math.round((a.content?.length || 0) * 3 / 4) }))
      );
    } else {
      console.log("gmail-send: no attachments");
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

    // Send with one retry on transient failures
    let sendData: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
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

      sendData = await sendRes.json();
      if (!sendData.error) break;

      // Retry only on 5xx or rate-limit errors
      const code = sendData.error.code || sendRes.status;
      if (attempt === 0 && (code >= 500 || code === 429)) {
        console.warn(`Gmail send attempt ${attempt + 1} failed (${code}), retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      break;
    }

    if (sendData.error) {
      console.error("Gmail API send error:", JSON.stringify(sendData.error), "to:", to);
      return new Response(
        JSON.stringify({ error: sendData.error.message || "Send failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert sent email into emails table so it's immediately available
    const toEmails = to.split(",").map((e: string) => e.trim()).filter(Boolean);
    const plainTextBody = html_body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const { data: insertedEmail } = await supabaseAdmin
      .from("emails")
      .upsert({
        company_id: connection.company_id,
        user_id: profileId,
        gmail_message_id: sendData.id,
        thread_id: sendData.threadId || null,
        subject,
        from_email: connection.email_address,
        from_name: connection.email_address,
        to_emails: toEmails,
        date: new Date().toISOString(),
        body_text: plainTextBody || null,
        body_html: html_body,
        snippet: plainTextBody.substring(0, 200),
        has_attachments: (attachments && attachments.length > 0) || false,
        labels: ["SENT"],
        is_read: true,
      }, { onConflict: "gmail_message_id,company_id" })
      .select("id")
      .single();

    // Auto-tag to project if project_id provided
    if (project_id && insertedEmail?.id) {
      await supabaseAdmin
        .from("email_project_tags")
        .insert({
          email_id: insertedEmail.id,
          project_id,
          company_id: connection.company_id,
          tagged_by_id: profileId,
          category: tag_category || "other",
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: sendData.id,
        thread_id: sendData.threadId,
        email_id: insertedEmail?.id || null,
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
