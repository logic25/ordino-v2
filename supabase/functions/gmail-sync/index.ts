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
    let updatedCount = 0;
    let totalChecked = 0;
    let pagesProcessed = 0;
    let partial = false;
    let historySynced = false;
    let latestHistoryId: string | null = connection.history_id || null;
    const newUnreadInbox: { gmail_message_id: string; subject: string; from_name: string }[] = [];

    const chunk = <T,>(arr: T[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

    const gmailJson = async (url: string) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const err = new Error(`gmail_${res.status}`) as Error & { status?: number };
        err.status = res.status;
        console.error("[gmail-sync] Gmail API request failed", res.status, text.substring(0, 500));
        throw err;
      }
      return data;
    };

    const listGmailIds = async (q: string, maxListPages = 20): Promise<Set<string>> => {
      const ids = new Set<string>();
      let listPageToken: string | undefined = undefined;
      let listPages = 0;
      while (listPages < maxListPages) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          partial = true;
          break;
        }
        const url = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
        url.searchParams.set("maxResults", "500");
        url.searchParams.set("q", q);
        if (listPageToken) url.searchParams.set("pageToken", listPageToken);
        const data = await gmailJson(url.toString());
        for (const msg of data.messages || []) ids.add(msg.id);
        if (!data.nextPageToken) break;
        listPageToken = data.nextPageToken;
        listPages++;
      }
      return ids;
    };

    const countOrdinoInboxUnread = async () => {
      const { count, error } = await supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false)
        .is("archived_at", null)
        .filter("labels", "cs", '["INBOX"]')
        .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`);
      if (error) {
        console.error("[gmail-sync] countOrdinoInboxUnread failed", error);
        return 0;
      }
      return count ?? 0;
    };

    const syncGmailMessage = async (messageId: string) => {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        partial = true;
        return { isNew: false, isUnreadInbox: false };
      }

      totalChecked++;
      const msgData = await gmailJson(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
      );
      if (msgData.historyId) latestHistoryId = msgData.historyId;

      if (!msgData.payload) {
        console.error("No payload for message:", messageId, JSON.stringify(msgData).substring(0, 500));
        return { isNew: false, isUnreadInbox: false };
      }

      const { data: existingEmail } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("gmail_message_id", messageId)
        .maybeSingle();
      const wasExisting = !!existingEmail;

      const headers = msgData.payload?.headers || [];
      if (headers.length === 0) console.error("No headers for message:", messageId);
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

      // Route bug replies once, but still import the email so unread reconciliation stays exact.
      const bugTagMatch = subject.match(/\[BUG-([a-f0-9]{8})\]/i);
      if (!wasExisting && bugTagMatch) {
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
        }
      }

      const dateStr = getHeader(headers, "Date");
      let emailDate: string | null = null;
      try {
        const parsed = new Date(dateStr);
        emailDate = !isNaN(parsed.getTime())
          ? parsed.toISOString()
          : new Date(parseInt(msgData.internalDate)).toISOString();
      } catch {
        try {
          emailDate = new Date(parseInt(msgData.internalDate)).toISOString();
        } catch {
          emailDate = new Date().toISOString();
        }
      }

      const labelIds: string[] = msgData.labelIds || [];
      const isUnread = labelIds.includes("UNREAD");
      const isInbox = labelIds.includes("INBOX");
      const upsertRow = {
        company_id: profile.company_id,
        user_id: profile.id,
        gmail_message_id: messageId,
        thread_id: msgData.threadId,
        subject,
        from_email,
        from_name,
        to_emails,
        date: emailDate,
        body_text,
        body_html,
        snippet: msgData.snippet || "",
        has_attachments: attachments.length > 0,
        labels: labelIds,
        is_read: !isUnread,
        synced_at: new Date().toISOString(),
        archived_at: isInbox ? null : undefined,
      };

      const doUpsert = async () =>
        await supabaseAdmin
          .from("emails")
          .upsert(upsertRow, { onConflict: "gmail_message_id,company_id" })
          .select("id")
          .single();

      let { data: saved, error: saveError } = await doUpsert();
      if (saveError && (saveError as any).code === "57014") {
        await new Promise((r) => setTimeout(r, 500));
        ({ data: saved, error: saveError } = await doUpsert());
      }
      if (saveError || !saved) {
        console.error("Email upsert error:", saveError);
        return { isNew: false, isUnreadInbox: isUnread && isInbox };
      }

      try {
        if (leadEmailToId.size > 0) {
          const fromLower = (from_email || "").trim().toLowerCase();
          const toLower = (to_emails || []).map((e: string) => e.trim().toLowerCase());
          const matchedLeadIds = new Set<string>();
          const directionByLead = new Map<string, "inbound" | "outbound">();

          const inboundLead = leadEmailToId.get(fromLower);
          if (inboundLead) {
            matchedLeadIds.add(inboundLead);
            directionByLead.set(inboundLead, "inbound");
          }
          for (const t of toLower) {
            const lid = leadEmailToId.get(t);
            if (lid && !directionByLead.has(lid)) {
              if (t === connectedMailbox) continue;
              matchedLeadIds.add(lid);
              directionByLead.set(lid, "outbound");
            }
          }

          for (const leadId of matchedLeadIds) {
            const direction = directionByLead.get(leadId)!;
            const snippetText = (msgData.snippet || body_text || "").substring(0, 280);
            const content = `${subject}\n\n${snippetText}`;
            const { error: actErr } = await supabaseAdmin.from("bd_activities").insert({
              company_id: profile.company_id,
              lead_id: leadId,
              type: "EMAIL",
              content,
              metadata: {
                email_id: messageId,
                thread_id: msgData.threadId,
                direction,
                from_email,
                from_name,
                to_emails,
                subject,
              },
              created_by: profile.id,
            } as any);
            if (actErr && (actErr as any).code !== "23505") {
              console.error("bd_activities insert error:", actErr);
            }
          }
        }
      } catch (e) {
        console.error("Lead auto-association failed:", e);
      }

      if (!wasExisting) {
        syncedCount++;
        if (isUnread && isInbox) {
          newUnreadInbox.push({ gmail_message_id: messageId, subject, from_name: from_name || from_email });
        }
        if (attachments.length > 0) {
          const attachmentRows = attachments.map((a: any) => ({
            email_id: saved.id,
            company_id: profile.company_id,
            filename: a.filename,
            mime_type: a.mime_type,
            size_bytes: a.size_bytes,
            gmail_attachment_id: a.gmail_attachment_id,
          }));
          await supabaseAdmin.from("email_attachments").insert(attachmentRows);
        }
      } else {
        updatedCount++;
      }

      return { isNew: !wasExisting, isUnreadInbox: isUnread && isInbox };
    };

    const ordinoUnreadBefore = await countOrdinoInboxUnread();

    // True incremental sync: process only messages Gmail says changed since the saved history id.
    if (connection.history_id) {
      try {
        const changedMessageIds = new Set<string>();
        let historyPageToken: string | undefined = undefined;
        let historyPages = 0;
        while (historyPages < 20) {
          if (Date.now() - startedAt > TIME_BUDGET_MS) {
            partial = true;
            break;
          }
          const historyUrl = new URL("https://www.googleapis.com/gmail/v1/users/me/history");
          historyUrl.searchParams.set("startHistoryId", connection.history_id);
          historyUrl.searchParams.set("maxResults", "500");
          historyUrl.searchParams.append("historyTypes", "messageAdded");
          historyUrl.searchParams.append("historyTypes", "labelAdded");
          historyUrl.searchParams.append("historyTypes", "labelRemoved");
          if (historyPageToken) historyUrl.searchParams.set("pageToken", historyPageToken);
          const historyData = await gmailJson(historyUrl.toString());
          if (historyData.historyId) latestHistoryId = historyData.historyId;
          for (const item of historyData.history || []) {
            for (const msg of item.messagesAdded || []) if (msg.message?.id) changedMessageIds.add(msg.message.id);
            for (const msg of item.labelsAdded || []) if (msg.message?.id) changedMessageIds.add(msg.message.id);
            for (const msg of item.labelsRemoved || []) if (msg.message?.id) changedMessageIds.add(msg.message.id);
            for (const msg of item.messages || []) if (msg.id) changedMessageIds.add(msg.id);
          }
          if (!historyData.nextPageToken) break;
          historyPageToken = historyData.nextPageToken;
          historyPages++;
        }

        for (const messageId of changedMessageIds) {
          try {
            await syncGmailMessage(messageId);
          } catch (e) {
            console.warn("[gmail-sync] skipped changed message", messageId, e);
          }
          if (partial) break;
        }
        historySynced = true;
        console.log(`[gmail-sync] history sync changed=${changedMessageIds.size}`);
      } catch (e: any) {
        console.warn("[gmail-sync] history sync unavailable; unread reconcile will still run", e?.message || e);
      }
    }

    // First-time backfill only. Subsequent syncs use Gmail History API + unread reconcile.
    if (!connection.history_id) {
      let pageToken: string | undefined = undefined;
      while (pagesProcessed < maxPages) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          partial = true;
          break;
        }
        const url = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
        url.searchParams.set("maxResults", "50");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const listData = await gmailJson(url.toString());
        if (!listData.messages || listData.messages.length === 0) break;
        for (const msg of listData.messages) {
          try {
            await syncGmailMessage(msg.id);
          } catch (e) {
            console.warn("[gmail-sync] skipped backfill message", msg.id, e);
          }
          if (partial) break;
        }
        if (partial) break;
        pageToken = listData.nextPageToken;
        pagesProcessed++;
        if (!pageToken) break;
      }
    }

    // Authoritative unread reconcile: Gmail's current `is:unread in:inbox` set wins.
    const gmailUnreadInboxSet = await listGmailIds("is:unread in:inbox", 20);
    let importedUnread = 0;
    for (const messageId of gmailUnreadInboxSet) {
      try {
        const result = await syncGmailMessage(messageId);
        if (result.isNew) importedUnread++;
      } catch (e) {
        console.warn("[gmail-sync] skipped unread reconcile message", messageId, e);
      }
      if (partial) break;
    }

    const { data: localInboxRows } = await supabaseAdmin
      .from("emails")
      .select("id, gmail_message_id, is_read")
      .eq("user_id", profile.id)
      .filter("labels", "cs", '["INBOX"]')
      .is("archived_at", null)
      .not("gmail_message_id", "is", null);

    const localInbox = localInboxRows || [];
    const toMarkRead = localInbox.filter(
      (row: any) => row.gmail_message_id && !gmailUnreadInboxSet.has(row.gmail_message_id) && row.is_read === false,
    );
    const toMarkUnread = localInbox.filter(
      (row: any) => row.gmail_message_id && gmailUnreadInboxSet.has(row.gmail_message_id) && row.is_read === true,
    );

    // Make Gmail's exact unread-inbox set authoritative: first clear all local inbox
    // unread bits, then re-apply unread only to Gmail's current set.
    for (const ids of chunk(localInbox.map((row: any) => row.id), 200)) {
      if (ids.length === 0) continue;
      await supabaseAdmin.from("emails").update({ is_read: true }).in("id", ids);
    }
    for (const ids of chunk(Array.from(gmailUnreadInboxSet), 200)) {
      if (ids.length === 0) continue;
      await supabaseAdmin
        .from("emails")
        .update({ is_read: false, archived_at: null })
        .eq("user_id", profile.id)
        .in("gmail_message_id", ids);
    }
    const markedUnread = toMarkUnread.length;

    const ordinoUnreadAfter = await countOrdinoInboxUnread();
    console.log(
      `[gmail-sync] unread reconcile gmail=${gmailUnreadInboxSet.size} ordino_before=${ordinoUnreadBefore} ordino_after=${ordinoUnreadAfter} imported=${importedUnread} marked_read=${toMarkRead.length} marked_unread=${markedUnread}`
    );

    try {
      const gmailProfile = await gmailJson("https://www.googleapis.com/gmail/v1/users/me/profile");
      if (gmailProfile.historyId) latestHistoryId = gmailProfile.historyId;
    } catch (e) {
      console.warn("[gmail-sync] unable to refresh Gmail profile history id", e);
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

    // Update last sync/history baseline
    await supabaseAdmin
      .from("gmail_connections")
      .update({ last_sync_at: new Date().toISOString(), history_id: latestHistoryId })
      .eq("id", connection.id);

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[gmail-sync] done synced=${syncedCount} updated=${updatedCount} checked=${totalChecked} pages=${pagesProcessed} history=${historySynced} partial=${partial} elapsed=${elapsedMs}ms`
    );

    // Broadcast sync-complete so clients can refresh email lists & unread badge
    // the instant sync finishes (Option C: no Realtime on the emails table).
    try {
      const channel = supabaseAdmin.channel(`gmail-sync:${profile.id}`);
      await channel.send({
        type: "broadcast",
        event: "sync_complete",
        payload: {
          synced: syncedCount,
          updated: updatedCount,
          new_unread: newUnreadInbox.length,
          gmail_unread_inbox: gmailUnreadInboxSet.size,
          ordino_unread_before: ordinoUnreadBefore,
          ordino_unread_after: ordinoUnreadAfter,
          at: new Date().toISOString(),
        },
      });
      await supabaseAdmin.removeChannel(channel);
    } catch (e) {
      console.warn("[gmail-sync] broadcast failed:", e);
    }

    return new Response(
      JSON.stringify({
        synced: syncedCount,
        updated: updatedCount,
        total_checked: totalChecked,
        pages_processed: pagesProcessed,
        history_synced: historySynced,
        partial,
        gmail_unread_inbox: gmailUnreadInboxSet.size,
        ordino_unread_before: ordinoUnreadBefore,
        ordino_unread_after: ordinoUnreadAfter,
        imported_unread: importedUnread,
        marked_read: toMarkRead.length,
        marked_unread: markedUnread,
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
