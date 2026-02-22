import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Handle CARD_CLICKED (button press)
    if (eventType === "CARD_CLICKED") {
      const action = event.action;
      if (action?.actionMethodName === "mark_done" || action?.function === "mark_done") {
        const params = action.parameters || [];
        const actionItemId = params.find((p: any) => p.key === "action_item_id")?.value;

        if (!actionItemId) {
          return jsonResponse({ text: "❌ Could not identify action item." });
        }

        // Mark done
        const { error } = await supabase
          .from("project_action_items")
          .update({ status: "done", completion_note: "Completed via Google Chat" } as any)
          .eq("id", actionItemId);

        if (error) {
          console.error("Error marking done:", error);
          return jsonResponse({ text: `❌ Error: ${error.message}` });
        }

        // Return updated card
        return jsonResponse({
          actionResponse: { type: "UPDATE_MESSAGE" },
          cardsV2: [
            {
              cardId: `action-item-${actionItemId}`,
              card: {
                header: {
                  title: "✅ Action Item Completed",
                  subtitle: `Marked done by ${event.user?.displayName || "someone"} via Google Chat`,
                  imageUrl: "https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/check_circle/default/48px.svg",
                  imageType: "CIRCLE",
                },
                sections: [
                  {
                    widgets: [
                      {
                        textParagraph: {
                          text: `<b>Completed at:</b> ${new Date().toLocaleString()}`,
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        });
      }
    }

    // Handle MESSAGE (thread reply)
    if (eventType === "MESSAGE") {
      const threadName = event.message?.thread?.name;
      const messageText = event.message?.text || "";
      const attachments = event.message?.attachment || [];

      if (!threadName) {
        return jsonResponse({ text: "I can only process replies in action item threads." });
      }

      // Find action item by thread
      const { data: items } = await supabase
        .from("project_action_items")
        .select("id, status, title, project_id, company_id")
        .eq("gchat_thread_id", threadName)
        .limit(1);

      if (!items || items.length === 0) {
        return jsonResponse({ text: "This thread isn't linked to an action item." });
      }

      const item = items[0];

      if (item.status === "done") {
        return jsonResponse({ text: `ℹ️ "${item.title}" is already completed.` });
      }

      // Check if user is marking done
      const isDone =
        messageText.toLowerCase().includes("done") ||
        messageText.toLowerCase().includes("complete") ||
        messageText.toLowerCase().includes("finished");

      if (isDone) {
        // Handle any image attachments
        const completionAttachments: { name: string; storage_path: string }[] = [];

        for (const att of attachments) {
          if (att.contentType?.startsWith("image/") && att.downloadUri) {
            try {
              const saKeyJson = Deno.env.get("GOOGLE_CHAT_SERVICE_ACCOUNT_KEY");
              if (saKeyJson) {
                // Download the image
                const imgRes = await fetch(att.downloadUri, {
                  headers: { Authorization: `Bearer ${await getAccessToken(saKeyJson)}` },
                });
                if (imgRes.ok) {
                  const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
                  const fileName = `${item.id}/${Date.now()}_${att.contentName || "photo.jpg"}`;

                  const { error: uploadErr } = await supabase.storage
                    .from("action-item-attachments")
                    .upload(fileName, imgBytes, {
                      contentType: att.contentType,
                    });

                  if (!uploadErr) {
                    completionAttachments.push({
                      name: att.contentName || "photo.jpg",
                      storage_path: fileName,
                    });
                  }
                }
              }
            } catch (e) {
              console.error("Failed to download/upload attachment:", e);
            }
          }
        }

        // Mark complete
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

      // Not a completion message - just acknowledge
      return jsonResponse({
        text: `📝 Noted on "${item.title}". Reply with "done" to mark it complete.`,
      });
    }

    // Handle ADDED_TO_SPACE
    if (eventType === "ADDED_TO_SPACE") {
      return jsonResponse({
        text: "👋 Ordino Action Items bot is ready! I'll post action items here as cards. Reply in a thread with \"done\" + an optional photo to complete items.",
      });
    }

    return jsonResponse({ text: "" });
  } catch (err) {
    console.error("gchat-interaction error:", err);
    return jsonResponse({ text: `❌ Error: ${err instanceof Error ? err.message : "Unknown"}` });
  }
});

function jsonResponse(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAccessToken(saKeyJson: string): Promise<string> {
  const saKey = JSON.parse(saKeyJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: saKey.client_email,
    scope: "https://www.googleapis.com/auth/chat.bot",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const pemContents = saKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signingInput}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}
