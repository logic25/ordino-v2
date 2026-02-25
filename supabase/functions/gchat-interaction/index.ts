import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Beacon RAG endpoint for non-task messages (redeployed 2026-02-25)
const BEACON_WEBHOOK_URL = "https://beaconrag.up.railway.app/webhook";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const event = await req.json();
    console.log("GChat interaction event:", JSON.stringify(event));

    const eventType = event.type;

    // Handle CARD_CLICKED (button press on task cards)
    if (eventType === "CARD_CLICKED") {
      return await handleCardClicked(event, supabase);
    }

    // Handle MESSAGE — route to task handler or Beacon
    if (eventType === "MESSAGE") {
      const threadName = event.message?.thread?.name;

      // Check if this is a reply in a known task thread
      if (threadName) {
        const { data: items } = await supabase
          .from("project_action_items")
          .select("id, status, title, project_id, company_id")
          .eq("gchat_thread_id", threadName)
          .limit(1);

        if (items && items.length > 0) {
          return await handleTaskThreadReply(event, items[0], supabase);
        }
      }

      // Not a task thread — forward to Beacon
      console.log("Forwarding to Beacon:", JSON.stringify(event).substring(0, 500));
      return await forwardToBeacon(event);
    }

    // Handle ADDED_TO_SPACE
    if (eventType === "ADDED_TO_SPACE") {
      return jsonResponse({
        text: "👋 Ordino bot is ready! I'll post tasks here as cards and answer questions about DOB filings, codes, and procedures. Reply in a task thread with \"done\" to complete items, or @mention me with any question.",
      });
    }

    return jsonResponse({ text: "" });
  } catch (err) {
    console.error("gchat-interaction error:", err);
    return jsonResponse({ text: `❌ Error: ${err instanceof Error ? err.message : "Unknown"}` });
  }
});

// ── Card click handler (status updates) ──────────────────────────────

async function handleCardClicked(event: any, supabase: any) {
  const action = event.action;
  const actionName = action?.actionMethodName || action?.function;
  const params = action?.parameters || [];

  const actionItemId = params.find((p: any) => p.key === "action_item_id")?.value;
  if (!actionItemId) {
    return jsonResponse({ text: "❌ Could not identify task." });
  }

  if (actionName === "mark_done" || actionName === "update_status") {
    const newStatus = actionName === "mark_done"
      ? "done"
      : params.find((p: any) => p.key === "status")?.value || "done";

    const updatePayload: any = { status: newStatus };
    if (newStatus === "done") {
      updatePayload.completion_note = `Completed via Google Chat by ${event.user?.displayName || "someone"}`;
    }

    const { data: item, error } = await supabase
      .from("project_action_items")
      .update(updatePayload)
      .eq("id", actionItemId)
      .select("title")
      .single();

    if (error) {
      console.error("Error updating status:", error);
      return jsonResponse({ text: `❌ Error: ${error.message}` });
    }

    const statusLabels: Record<string, string> = {
      open: "⏳ Pending",
      in_progress: "🔄 In Progress",
      done: "✅ Completed",
      blocked: "🚫 Blocked",
    };

    const statusLabel = statusLabels[newStatus] || newStatus;

    return jsonResponse({
      actionResponse: { type: "UPDATE_MESSAGE" },
      cardsV2: [
        {
          cardId: `action-item-${actionItemId}`,
          card: {
            header: {
              title: `${statusLabel}`,
              subtitle: `${item?.title || "Task"} — updated by ${event.user?.displayName || "someone"}`,
              imageUrl: newStatus === "done"
                ? "https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/check_circle/default/48px.svg"
                : "https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/task_alt/default/48px.svg",
              imageType: "CIRCLE",
            },
            sections: [
              {
                widgets: [
                  {
                    textParagraph: {
                      text: `<b>Status:</b> ${statusLabel}<br><b>Updated:</b> ${new Date().toLocaleString()}`,
                    },
                  },
                ],
              },
              ...(newStatus !== "done" ? [{
                widgets: [{
                  buttonList: {
                    buttons: [
                      {
                        text: "✅ Done",
                        onClick: {
                          action: {
                            function: "update_status",
                            parameters: [
                              { key: "action_item_id", value: actionItemId },
                              { key: "status", value: "done" },
                            ],
                          },
                        },
                      },
                    ],
                  },
                }],
              }] : []),
            ],
          },
        },
      ],
    });
  }

  return jsonResponse({ text: "" });
}

// ── Task thread reply handler ────────────────────────────────────────

async function handleTaskThreadReply(event: any, item: any, supabase: any) {
  const messageText = event.message?.text || "";
  const attachments = event.message?.attachment || [];

  if (item.status === "done") {
    return jsonResponse({ text: `ℹ️ "${item.title}" is already completed.` });
  }

  const isDone =
    messageText.toLowerCase().includes("done") ||
    messageText.toLowerCase().includes("complete") ||
    messageText.toLowerCase().includes("finished");

  if (isDone) {
    const completionAttachments: { name: string; storage_path: string }[] = [];

    for (const att of attachments) {
      if (att.contentType?.startsWith("image/") && att.downloadUri) {
        try {
          const { data: aiItem } = await supabase
            .from("project_action_items")
            .select("assigned_by")
            .eq("id", item.id)
            .single();

          if (aiItem?.assigned_by) {
            const { data: conn } = await supabase
              .from("gmail_connections")
              .select("access_token, refresh_token, token_expires_at")
              .eq("user_id", aiItem.assigned_by)
              .single();

            if (conn?.access_token) {
              let token = conn.access_token;
              const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0);
              if (expiresAt <= new Date()) {
                const clientId = Deno.env.get("GMAIL_CLIENT_ID");
                const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
                if (clientId && clientSecret) {
                  token = await refreshAccessToken(conn.refresh_token, clientId, clientSecret, supabase, aiItem.assigned_by);
                }
              }

              const imgRes = await fetch(att.downloadUri, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (imgRes.ok) {
                const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
                const fileName = `${item.id}/${Date.now()}_${att.contentName || "photo.jpg"}`;

                const { error: uploadErr } = await supabase.storage
                  .from("action-item-attachments")
                  .upload(fileName, imgBytes, { contentType: att.contentType });

                if (!uploadErr) {
                  completionAttachments.push({
                    name: att.contentName || "photo.jpg",
                    storage_path: fileName,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("Failed to download/upload attachment:", e);
        }
      }
    }

    const { error } = await supabase
      .from("project_action_items")
      .update({
        status: "done",
        completion_note: messageText || "Completed via Google Chat reply",
        completion_attachments: completionAttachments.length > 0 ? completionAttachments : undefined,
      } as any)
      .eq("id", item.id);

    if (error) {
      return jsonResponse({ text: `❌ Error marking done: ${error.message}` });
    }

    const photoNote = completionAttachments.length > 0
      ? ` (${completionAttachments.length} photo${completionAttachments.length > 1 ? "s" : ""} saved)`
      : "";

    return jsonResponse({
      text: `✅ "${item.title}" marked as done!${photoNote}`,
    });
  }

  // Not a completion message — just acknowledge
  return jsonResponse({
    text: `📝 Noted on "${item.title}". Reply with "done" to mark it complete.`,
  });
}

// ── Forward to Beacon ────────────────────────────────────────────────

async function forwardToBeacon(event: any): Promise<Response> {
  try {
    const beaconRes = await fetch(BEACON_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(30000),
    });

    if (!beaconRes.ok) {
      const errBody = await beaconRes.text();
      console.error("Beacon webhook error:", beaconRes.status, errBody.substring(0, 300));
      return jsonResponse({ text: "⚠️ I couldn't process that right now. Please try again." });
    }

    const text = await beaconRes.text();
    console.log("Beacon response status:", beaconRes.status, "body length:", text.length, "preview:", text.substring(0, 200));

    // Beacon may return 204 with empty body for async processing
    if (beaconRes.status === 204 || !text) {
      return jsonResponse({ text: "" });
    }

    try {
      const beaconData = JSON.parse(text);
      return jsonResponse(beaconData);
    } catch {
      return jsonResponse({ text: text });
    }
  } catch (err) {
    console.error("Beacon forward error:", err);
    return jsonResponse({ text: "⚠️ Request timed out. Please try again." });
  }
}

// ── Utilities ────────────────────────────────────────────────────────

function jsonResponse(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  supabaseAdmin: any,
  profileId: string
): Promise<string> {
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
  if (!tokenData.access_token) {
    throw new Error("token_refresh_failed:" + JSON.stringify(tokenData));
  }
  await supabaseAdmin
    .from("gmail_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    })
    .eq("user_id", profileId);
  return tokenData.access_token;
}
