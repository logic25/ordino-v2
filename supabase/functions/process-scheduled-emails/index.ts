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

function createMimeMessage({
  to,
  cc,
  bcc,
  from,
  subject,
  body,
  in_reply_to,
  references,
}: {
  to: string;
  cc?: string;
  bcc?: string;
  from: string;
  subject: string;
  body: string;
  in_reply_to?: string;
  references?: string;
}): string {
  const boundary = "boundary_" + Date.now();
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (cc) headers.splice(1, 0, `Cc: ${cc}`);
  if (bcc) headers.splice(cc ? 2 : 1, 0, `Bcc: ${bcc}`);
  if (in_reply_to) headers.push(`In-Reply-To: ${in_reply_to}`);
  if (references) headers.push(`References: ${references}`);

  const plainBody = body.replace(/<[^>]*>/g, "");

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

  const encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return encoded;
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find all due scheduled emails
    const now = new Date().toISOString();
    const { data: dueEmails, error: fetchError } = await supabaseAdmin
      .from("scheduled_emails")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_send_time", now)
      .limit(50);

    if (fetchError) throw fetchError;

    if (!dueEmails || dueEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let errors = 0;

    for (const scheduled of dueEmails) {
      try {
        const draft = scheduled.email_draft as any;

        // Get the user's Gmail connection
        const { data: connection } = await supabaseAdmin
          .from("gmail_connections")
          .select("*")
          .eq("user_id", scheduled.user_id)
          .single();

        if (!connection) {
          await supabaseAdmin
            .from("scheduled_emails")
            .update({ status: "failed", error_message: "Gmail not connected" })
            .eq("id", scheduled.id);
          errors++;
          continue;
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
            await supabaseAdmin
              .from("scheduled_emails")
              .update({ status: "failed", error_message: "Token refresh failed" })
              .eq("id", scheduled.id);
            errors++;
            continue;
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

        // Build reply context if needed
        let in_reply_to: string | undefined;
        let references: string | undefined;
        let threadId: string | undefined;

        if (draft.reply_to_email_id) {
          const { data: originalEmail } = await supabaseAdmin
            .from("emails")
            .select("gmail_message_id, thread_id")
            .eq("id", draft.reply_to_email_id)
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

        // Create and send
        const raw = createMimeMessage({
          to: draft.to,
          cc: draft.cc || undefined,
          bcc: draft.bcc || undefined,
          from: connection.email_address,
          subject: draft.subject,
          body: draft.html_body,
          in_reply_to,
          references,
        });

        const sendBody: any = { raw };
        if (threadId) sendBody.threadId = threadId;

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
          await supabaseAdmin
            .from("scheduled_emails")
            .update({
              status: "failed",
              error_message: sendData.error.message || "Send failed",
            })
            .eq("id", scheduled.id);
          errors++;
          continue;
        }

        // Mark as sent
        await supabaseAdmin
          .from("scheduled_emails")
          .update({
            status: "sent",
            gmail_message_id: sendData.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        processed++;
      } catch (err) {
        console.error(`Error processing scheduled email ${scheduled.id}:`, err);
        await supabaseAdmin
          .from("scheduled_emails")
          .update({
            status: "failed",
            error_message: err.message || "Unknown error",
          })
          .eq("id", scheduled.id);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ processed, errors, total: dueEmails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Process scheduled emails error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
