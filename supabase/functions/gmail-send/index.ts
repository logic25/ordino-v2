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
  content: string;
  mime_type: string;
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    return decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(padded);
  }
}

async function fetchGmailMessagePartData({
  accessToken,
  gmailMessageId,
  attachmentId,
}: {
  accessToken: string;
  gmailMessageId: string;
  attachmentId: string;
}): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    console.warn("gmail-send failed to fetch Gmail message part attachment", {
      gmail_message_id: gmailMessageId,
      attachment_id: attachmentId,
      status: res.status,
    });
    return "";
  }

  const data = await res.json();
  return data?.data ? decodeBase64Url(data.data) : "";
}

async function extractEmailBodies(
  payload: any,
  {
    accessToken,
    gmailMessageId,
  }: {
    accessToken: string;
    gmailMessageId: string;
  }
): Promise<{ body_text: string; body_html: string }> {
  let body_text = "";
  let body_html = "";

  async function readPartBody(part: any): Promise<string> {
    if (part?.body?.data) return decodeBase64Url(part.body.data);
    if (part?.body?.attachmentId && gmailMessageId) {
      return fetchGmailMessagePartData({
        accessToken,
        gmailMessageId,
        attachmentId: part.body.attachmentId,
      });
    }
    return "";
  }

  async function walk(part: any) {
    if (!part) return;

    if (part.mimeType === "text/plain" && !body_text) {
      body_text = await readPartBody(part);
    } else if (part.mimeType === "text/html" && !body_html) {
      body_html = await readPartBody(part);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        await walk(child);
      }
    }
  }

  await walk(payload);
  return { body_text, body_html };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildForwardHtml({
  userMessage,
  fromName,
  fromEmail,
  subject,
  sentAt,
  originalHtml,
  originalText,
}: {
  userMessage: string;
  fromName?: string | null;
  fromEmail?: string | null;
  subject?: string | null;
  sentAt?: string | null;
  originalHtml?: string | null;
  originalText?: string | null;
}) {
  const headerBits = [
    fromName || fromEmail ? `From: ${escapeHtml(fromName || fromEmail || "")}` : "",
    sentAt ? `Date: ${escapeHtml(new Date(sentAt).toLocaleString())}` : "",
    subject ? `Subject: ${escapeHtml(subject)}` : "",
  ].filter(Boolean);

  const recoveredOriginal = originalHtml?.trim()
    ? originalHtml
    : originalText?.trim()
      ? `<pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(originalText)}</pre>`
      : "<p><em>Original message content could not be recovered.</em></p>";

  return [
    userMessage,
    "<br><hr>",
    '<div style="margin-top:12px">',
    '<p><strong>---------- Forwarded message ----------</strong></p>',
    headerBits.map((line) => `<div>${line}</div>`).join(""),
    recoveredOriginal,
    "</div>",
  ].join("");
}

async function fetchOriginalMessageContent({
  supabaseAdmin,
  accessToken,
  emailId,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  accessToken: string;
  emailId: string;
}) {
  const { data: originalEmail } = await supabaseAdmin
    .from("emails")
    .select("id, gmail_message_id, thread_id, body_html, body_text, subject, from_name, from_email, date")
    .eq("id", emailId)
    .single();

  if (!originalEmail) return null;

  console.log("gmail-send forward source email", {
    email_id: emailId,
    gmail_message_id: originalEmail.gmail_message_id,
    has_stored_html: !!originalEmail.body_html,
    has_stored_text: !!originalEmail.body_text,
    stored_html_length: originalEmail.body_html?.length || 0,
    stored_text_length: originalEmail.body_text?.length || 0,
    subject: originalEmail.subject,
  });

  let bodyHtml = originalEmail.body_html || "";
  let bodyText = originalEmail.body_text || "";

  if ((!bodyHtml || !bodyText) && originalEmail.gmail_message_id) {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${originalEmail.gmail_message_id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (msgRes.ok) {
      const msgData = await msgRes.json();
      const extracted = await extractEmailBodies(msgData.payload, {
        accessToken,
        gmailMessageId: originalEmail.gmail_message_id,
      });
      bodyHtml = bodyHtml || extracted.body_html;
      bodyText = bodyText || extracted.body_text;

      console.log("gmail-send recovered original body", {
        email_id: emailId,
        had_stored_html: !!originalEmail.body_html,
        had_stored_text: !!originalEmail.body_text,
        recovered_html: !!extracted.body_html,
        recovered_text: !!extracted.body_text,
        recovered_html_length: extracted.body_html?.length || 0,
        recovered_text_length: extracted.body_text?.length || 0,
      });

      if ((bodyHtml && !originalEmail.body_html) || (bodyText && !originalEmail.body_text)) {
        await supabaseAdmin
          .from("emails")
          .update({
            body_html: bodyHtml || null,
            body_text: bodyText || null,
            snippet: (bodyText || bodyHtml.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 200) || null,
          })
          .eq("id", emailId);
      }
    } else {
      console.warn("gmail-send failed to fetch original Gmail message", {
        email_id: emailId,
        gmail_message_id: originalEmail.gmail_message_id,
        status: msgRes.status,
      });
    }
  }

  return {
    ...originalEmail,
    body_html: bodyHtml,
    body_text: bodyText,
  };
}

function buildFromHeader(emailAddress: string, displayName?: string | null): string {
  if (!displayName) return emailAddress;
  // Escape quotes/backslashes and RFC 2047-encode non-ASCII display names.
  const safe = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const encoded = /[^\x20-\x7E]/.test(safe)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(safe)))}?=`
    : `"${safe}"`;
  return `${encoded} <${emailAddress}>`;
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

  function wrapBase64(b64: string): string {
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += 76) lines.push(b64.substring(i, i + 76));
    return lines.join("\r\n");
  }

  function toWebSafeBase64(str: string): string {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  if (!hasAttachments) {
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

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

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

  const attachmentParts: string[] = [];
  for (const att of attachments!) {
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
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(fullMessage);
  let binaryStr = "";
  for (let i = 0; i < messageBytes.length; i++) binaryStr += String.fromCharCode(messageBytes[i]);
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
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;

    let profileId: string;

    if (isServiceRole) {
      const reqBody = await req.json();
      const { to, cc, bcc, subject, html_body, reply_to_email_id, forward_from_email_id, attachments, user_id: bodyUserId, from_name, append_signature } = reqBody;

      if (!bodyUserId) {
        return new Response(JSON.stringify({ error: "user_id required for service-role calls" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      profileId = bodyUserId;
      (req as any)._parsedBody = { to, cc, bcc, subject, html_body, reply_to_email_id, forward_from_email_id, attachments, from_name, append_signature };
    } else {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await supabaseUser.auth.getUser();

      if (!user) {
        console.error("getUser returned null user. Auth header present:", !!authHeader, "Token prefix:", authHeader?.substring(0, 20), userError?.message);
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
    console.log("gmail-send: body keys", Object.keys(reqBody || {}), "attachments_in_body:", Array.isArray(reqBody?.attachments) ? reqBody.attachments.length : typeof reqBody?.attachments);
    const { to, cc, bcc, subject, html_body, reply_to_email_id, forward_from_email_id, attachments, project_id, proposal_id, change_order_id, invoice_id, tag_category, from_name, append_signature } = reqBody;

    if (!to || !subject || !html_body) {
      console.error("Missing required fields", { to: !!to, subject: !!subject, html_body: !!html_body });
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html_body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
    }

    let in_reply_to: string | undefined;
    let references: string | undefined;
    let threadId: string | undefined;
    let finalHtmlBody = html_body;

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

    if (forward_from_email_id) {
      const originalForwardEmail = await fetchOriginalMessageContent({
        supabaseAdmin,
        accessToken,
        emailId: forward_from_email_id,
      });

      if (originalForwardEmail) {
        finalHtmlBody = buildForwardHtml({
          userMessage: html_body,
          fromName: originalForwardEmail.from_name,
          fromEmail: originalForwardEmail.from_email,
          subject: originalForwardEmail.subject,
          sentAt: originalForwardEmail.date,
          originalHtml: originalForwardEmail.body_html,
          originalText: originalForwardEmail.body_text,
        });
      }
    }




    // Auto-append the Gmail signature unless caller opted out, the body
    // already contains a signature marker, or this is a reply/forward where
    // the existing thread already includes one.
    const wantsSignature = append_signature !== false && !reply_to_email_id && !forward_from_email_id;
    if (wantsSignature && !/<!--\s*signature\s*-->/i.test(finalHtmlBody)) {
      let sig: string | null = (connection as any).signature_html || null;
      const lastSync = (connection as any).signature_synced_at
        ? new Date((connection as any).signature_synced_at).getTime()
        : 0;
      const stale = Date.now() - lastSync > 24 * 60 * 60 * 1000;
      if (!sig || stale) {
        try {
          const res = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (res.ok) {
            const data = await res.json();
            const sendAs = Array.isArray(data?.sendAs) ? data.sendAs : [];
            const match =
              sendAs.find((s: any) => s.isPrimary && s.sendAsEmail?.toLowerCase() === connection.email_address.toLowerCase()) ||
              sendAs.find((s: any) => s.isDefault) ||
              sendAs.find((s: any) => s.sendAsEmail?.toLowerCase() === connection.email_address.toLowerCase()) ||
              sendAs[0];
            sig = match?.signature || sig || "";
            await supabaseAdmin
              .from("gmail_connections")
              .update({ signature_html: sig || null, signature_synced_at: new Date().toISOString() })
              .eq("id", connection.id);
          }
        } catch (e) {
          console.warn("gmail-send: sendAs signature fetch failed", e);
        }
      }
      if (sig && sig.trim().length > 0) {
        finalHtmlBody = `${finalHtmlBody}<br><!-- signature --><div>${sig}</div>`;
      }
    }

    if (attachments && attachments.length > 0) {
      console.log(`gmail-send: ${attachments.length} attachment(s) included:`,
        attachments.map((a: any) => ({ filename: a.filename, mime_type: a.mime_type, size_bytes: Math.round((a.content?.length || 0) * 3 / 4) }))
      );
    } else {
      console.log("gmail-send: no attachments");
    }

    console.log("gmail-send forward trace", {
      reply_to_email_id: reply_to_email_id || null,
      forward_from_email_id: forward_from_email_id || null,
      html_length: finalHtmlBody.length,
      html_preview: finalHtmlBody.slice(0, 1500),
    });
    console.log("gmail-send html_body full START");
    console.log(finalHtmlBody);
    console.log("gmail-send html_body full END");

    const raw = createMimeMessage({
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      from: buildFromHeader(connection.email_address, from_name),
      subject,
      body: finalHtmlBody,
      in_reply_to,
      references,
      attachments: attachments || undefined,
    });

    const sendBody: any = { raw };
    if (threadId) {
      sendBody.threadId = threadId;
    }

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

    const toEmails = to.split(",").map((e: string) => e.trim()).filter(Boolean);
    const plainTextBody = finalHtmlBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const { data: insertedEmail } = await supabaseAdmin
      .from("emails")
      .upsert({
        company_id: connection.company_id,
        user_id: profileId,
        gmail_message_id: sendData.id,
        thread_id: sendData.threadId || null,
        subject,
        from_email: connection.email_address,
        from_name: from_name || connection.email_address,
        to_emails: toEmails,
        date: new Date().toISOString(),
        body_text: plainTextBody || null,
        body_html: finalHtmlBody,
        snippet: plainTextBody.substring(0, 200),
        has_attachments: (attachments && attachments.length > 0) || false,
        labels: ["SENT"],
        is_read: true,
      }, { onConflict: "gmail_message_id,company_id" })
      .select("id")
      .single();

    // Tag the outbound email to any record passed in. project_id stays as the
    // rollup anchor; proposal_id / change_order_id / invoice_id let detail views
    // surface their own thread. One row, multiple pointers.
    const hasAnyTarget = project_id || proposal_id || change_order_id || invoice_id;
    if (hasAnyTarget && insertedEmail?.id) {
      await supabaseAdmin
        .from("email_project_tags")
        .insert({
          email_id: insertedEmail.id,
          project_id: project_id || null,
          proposal_id: proposal_id || null,
          change_order_id: change_order_id || null,
          invoice_id: invoice_id || null,
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