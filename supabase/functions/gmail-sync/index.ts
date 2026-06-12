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

function stripQuotedContent(text: string): string {
  // Remove HTML tags first if it looks like HTML
  let clean = text;
  if (clean.includes("<")) {
    // Remove gmail_quote divs and everything after
    clean = clean.replace(/<div class="gmail_quote">[\s\S]*/i, "");
    // Strip remaining HTML tags
    clean = clean.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  // Remove common reply markers and everything after
  const markers = [
    /\n\s*On .+wrote:\s*$/s,
    /\n\s*-{3,}\s*Original Message\s*-{3,}[\s\S]*/i,
    /\n\s*_{3,}[\s\S]*/,
    /\n\s*From:.*\nSent:.*\n/i,
    /\n\s*>.*$/s,
  ];
  for (const marker of markers) {
    clean = clean.replace(marker, "");
  }
  return clean.trim();
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

    // Determine if this is the first sync (deep) or incremental
    const isFirstSync = !connection.last_sync_at;
    
    // Parse optional maxPages from request body
    let maxPages = isFirstSync ? 10 : 3; // First sync: 10 pages (~500 msgs), subsequent: 3 pages (~150 msgs)
    try {
      const body = await req.json();
      if (body?.maxPages) maxPages = Math.min(body.maxPages, 20);
    } catch { /* no body is fine */ }
    
    // For first sync, allow more consecutive existing pages before stopping
    const maxFullyExistingPages = isFirstSync ? 5 : 2;

    // Wall-clock budget — always return before the edge runtime kills us
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 60_000;

    // Pre-fetch sender email -> profile id map ONCE (replaces per-email auth.admin loop)
    const senderEmailToProfileId = new Map<string, string>();
    try {
      const { data: companyProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id")
        .eq("company_id", profile.company_id)
        .eq("is_active", true);
      if (companyProfiles && companyProfiles.length > 0) {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const userIdToEmail = new Map<string, string>();
        for (const u of authList?.users || []) {
          if (u.email) userIdToEmail.set(u.id, u.email.toLowerCase());
        }
        for (const cp of companyProfiles) {
          const em = userIdToEmail.get(cp.user_id);
          if (em) senderEmailToProfileId.set(em, cp.id);
        }
      }
    } catch (e) {
      console.error("Failed to build sender->profile map:", e);
    }

    // Pre-fetch BD leads (id, contact_email) for this company — exact email match only.
    const leadEmailToId = new Map<string, string>();
    try {
      const { data: leadRows } = await supabaseAdmin
        .from("leads")
        .select("id, contact_email")
        .eq("company_id", profile.company_id)
        .not("contact_email", "is", null);
      for (const l of leadRows || []) {
        const em = (l.contact_email || "").trim().toLowerCase();
        if (em) leadEmailToId.set(em, l.id);
      }
    } catch (e) {
      console.error("Failed to build lead email map:", e);
    }
    const connectedMailbox = (connection.email_address || "").trim().toLowerCase();


    let syncedCount = 0;
    let totalChecked = 0;
    let pageToken: string | undefined = undefined;
    let pagesProcessed = 0;
    let fullyExistingPages = 0;
    let partial = false;
    // Track read-state sync-back + new unread inbox emails
    const newUnreadInbox: { gmail_message_id: string; subject: string; from_name: string }[] = [];
    const readGmailIds: string[] = [];
    const unreadGmailIds: string[] = [];

    while (pagesProcessed < maxPages) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        partial = true;
        break;
      }

      const url = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
      url.searchParams.set("maxResults", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const listRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const listData = await listRes.json();

      if (!listData.messages || listData.messages.length === 0) break;

      let newOnThisPage = 0;
      for (const msg of listData.messages) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          partial = true;
          break;
        }
        totalChecked++;

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
          console.error("No headers for message:", msg.id);
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

        const subject = getHeader(headers, "Subject") || "(no subject)";

        // ── Bug reply detection ──
        const bugTagMatch = subject.match(/\[BUG-([a-f0-9]{8})\]/i);
        if (bugTagMatch) {
          const bugIdPrefix = bugTagMatch[1].toLowerCase();
          const { data: matchingBug } = await supabaseAdmin
            .from("feature_requests")
            .select("id, company_id, user_id")
            .eq("company_id", profile.company_id)
            .eq("category", "bug_report")
            .like("id", `${bugIdPrefix}%`)
            .maybeSingle();

          if (matchingBug) {
            const replyBody = stripQuotedContent(body_text || body_html || "");
            if (replyBody.trim()) {
              const senderProfileId =
                (from_email && senderEmailToProfileId.get(from_email.toLowerCase())) || profile.id;

              await supabaseAdmin.from("bug_comments").insert({
                bug_id: matchingBug.id,
                company_id: matchingBug.company_id,
                user_id: senderProfileId,
                message: replyBody.trim(),
              });

              await supabaseAdmin.from("bug_activity_logs").insert({
                bug_id: matchingBug.id,
                company_id: matchingBug.company_id,
                user_id: senderProfileId,
                action_type: "email_reply",
                note: replyBody.trim().substring(0, 200),
              });

              console.log(`Routed email reply to bug ${matchingBug.id} from ${from_email}`);
            }
            newOnThisPage++;
            syncedCount++;
            continue;
          }
        }

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

        // Upsert (replaces existence SELECT + INSERT). With ignoreDuplicates, a duplicate returns null.
        const upsertRow = {
          company_id: profile.company_id,
          user_id: profile.id,
          gmail_message_id: msg.id,
          thread_id: msg.threadId,
          subject,
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
        };

        const doUpsert = async () =>
          await supabaseAdmin
            .from("emails")
            .upsert(upsertRow, { onConflict: "gmail_message_id,company_id", ignoreDuplicates: true })
            .select("id")
            .maybeSingle();

        let { data: inserted, error: insertError } = await doUpsert();
        if (insertError && (insertError as any).code === "57014") {
          await new Promise((r) => setTimeout(r, 500));
          ({ data: inserted, error: insertError } = await doUpsert());
        }

        if (insertError) {
          console.error("Insert error:", insertError);
          continue;
        }

        const labelIds: string[] = msgData.labelIds || [];
        const isUnread = labelIds.includes("UNREAD");
        const isInbox = labelIds.includes("INBOX");
        if (isUnread) unreadGmailIds.push(msg.id);
        else readGmailIds.push(msg.id);

        // inserted === null => row already existed (skipped by ignoreDuplicates)
        if (!inserted) continue;

        if (isUnread && isInbox) {
          newUnreadInbox.push({ gmail_message_id: msg.id, subject, from_name: from_name || from_email });
        }

        if (attachments.length > 0) {
          const attachmentRows = attachments.map((a: any) => ({
            email_id: inserted!.id,
            company_id: profile.company_id,
            filename: a.filename,
            mime_type: a.mime_type,
            size_bytes: a.size_bytes,
            gmail_attachment_id: a.gmail_attachment_id,
          }));

          await supabaseAdmin.from("email_attachments").insert(attachmentRows);
        }

        newOnThisPage++;
        syncedCount++;
      }

      if (partial) break;

      if (newOnThisPage === 0) {
        fullyExistingPages++;
      } else {
        fullyExistingPages = 0;
      }

      if (fullyExistingPages >= maxFullyExistingPages) break;

      pageToken = listData.nextPageToken;
      if (!pageToken) break;
      pagesProcessed++;
    }

    // Sync read-state back from Gmail for existing rows (chunked to avoid huge IN lists)
    try {
      const chunk = <T,>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
      for (const ids of chunk(readGmailIds, 200)) {
        if (ids.length === 0) continue;
        await supabaseAdmin
          .from("emails")
          .update({ is_read: true })
          .eq("user_id", profile.id)
          .in("gmail_message_id", ids)
          .eq("is_read", false);
      }
      for (const ids of chunk(unreadGmailIds, 200)) {
        if (ids.length === 0) continue;
        await supabaseAdmin
          .from("emails")
          .update({ is_read: false })
          .eq("user_id", profile.id)
          .in("gmail_message_id", ids)
          .eq("is_read", true);
      }
    } catch (e) {
      console.error("Failed to sync read-state back from Gmail:", e);
    }

    // Create a bell notification when new unread inbox emails arrived
    if (newUnreadInbox.length > 0) {
      try {
        const count = newUnreadInbox.length;
        const previewSenders = Array.from(
          new Set(newUnreadInbox.slice(0, 3).map((e) => e.from_name).filter(Boolean))
        ).join(", ");
        const title = count === 1 ? "1 new email" : `${count} new emails`;
        const body =
          count === 1
            ? `${newUnreadInbox[0].from_name}: ${newUnreadInbox[0].subject}`
            : previewSenders
              ? `From ${previewSenders}${count > 3 ? ` and ${count - 3} more` : ""}`
              : undefined;
        await supabaseAdmin.from("notifications").insert({
          company_id: profile.company_id,
          user_id: profile.id,
          type: "email_received",
          title,
          body,
          link: "/emails",
        });
      } catch (e) {
        console.error("Failed to insert email_received notification:", e);
      }
    }

    // Update last sync
    await supabaseAdmin
      .from("gmail_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[gmail-sync] done synced=${syncedCount} checked=${totalChecked} pages=${pagesProcessed + 1} partial=${partial} elapsed=${elapsedMs}ms`
    );

    return new Response(
      JSON.stringify({
        synced: syncedCount,
        total_checked: totalChecked,
        pages_processed: pagesProcessed + 1,
        partial,
      }),
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
