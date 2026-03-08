import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Beacon RAG endpoint for non-task messages (fix empty-response 2026-02-25)
const BEACON_WEBHOOK_URL = "https://beaconrag.up.railway.app/webhook";

// Google Chat JWT issuer
const CHAT_ISSUER = "chat@system.gserviceaccount.com";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/service_accounts/v1/metadata/x509/chat%40system.gserviceaccount.com";

// Cache Google's public certs (they rotate infrequently)
let cachedCerts: Record<string, string> | null = null;
let certsCachedAt = 0;
const CERTS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() - certsCachedAt < CERTS_TTL_MS) {
    return cachedCerts;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  cachedCerts = await res.json();
  certsCachedAt = Date.now();
  return cachedCerts!;
}

/** Import an X.509 PEM certificate as a CryptoKey for RS256 verification */
async function importX509Key(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  // Extract the SubjectPublicKeyInfo from the X.509 certificate
  // The public key is embedded in the certificate — we use a DER parser approach
  return await crypto.subtle.importKey(
    "raw",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  ).catch(async () => {
    // Fallback: try importing from the SPKI extracted via certificate parsing
    // Use the certificate directly with a manual SPKI extraction
    return await importSpkiFromCert(binary);
  });
}

/** Extract SPKI from X.509 DER certificate and import as CryptoKey */
async function importSpkiFromCert(certDer: Uint8Array): Promise<CryptoKey> {
  // Simple ASN.1 parser to extract SubjectPublicKeyInfo from X.509
  // TBSCertificate → version → serialNumber → signature → issuer → validity → subject → subjectPublicKeyInfo
  let offset = 0;
  
  function readTag(): { tag: number; length: number; headerLen: number } {
    const tag = certDer[offset++];
    let length = certDer[offset++];
    let headerLen = 2;
    if (length & 0x80) {
      const numBytes = length & 0x7f;
      length = 0;
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | certDer[offset++];
        headerLen++;
      }
    }
    return { tag, length, headerLen };
  }
  
  function skipElement() {
    const { length } = readTag();
    offset += length;
  }
  
  // Outer SEQUENCE (Certificate)
  readTag();
  // TBSCertificate SEQUENCE
  const tbsStart = offset;
  readTag();
  
  // version [0] EXPLICIT
  if (certDer[offset] === 0xa0) {
    skipElement();
  }
  // serialNumber
  skipElement();
  // signature AlgorithmIdentifier
  skipElement();
  // issuer
  skipElement();
  // validity
  skipElement();
  // subject
  skipElement();
  
  // subjectPublicKeyInfo — this is what we want
  const spkiStart = offset;
  const spkiTag = readTag();
  const spkiBytes = certDer.slice(spkiStart, offset + spkiTag.length);
  
  return await crypto.subtle.importKey(
    "spki",
    spkiBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/** Decode a base64url string */
function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
}

/**
 * Verify a Google Chat JWT Bearer token.
 * Returns the decoded payload if valid, or null if verification fails.
 */
async function verifyGoogleChatToken(token: string, expectedAudience: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const headerJson = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
    const payloadJson = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));

    // Check issuer
    if (payloadJson.iss !== CHAT_ISSUER) {
      console.log("JWT verification failed: issuer mismatch:", payloadJson.iss);
      return null;
    }

    // Check audience
    if (payloadJson.aud !== expectedAudience) {
      console.log("JWT verification failed: audience mismatch. Expected:", expectedAudience, "Got:", payloadJson.aud);
      return null;
    }

    // Check expiry
    if (payloadJson.exp && payloadJson.exp < Math.floor(Date.now() / 1000)) {
      console.log("JWT verification failed: token expired");
      return null;
    }

    // Verify signature using Google's public certs
    const certs = await getGoogleCerts();
    const kid = headerJson.kid;
    const certPem = kid ? certs[kid] : Object.values(certs)[0];
    if (!certPem) {
      console.log("JWT verification failed: no matching cert for kid:", kid);
      return null;
    }

    const key = await importSpkiFromCert(
      Uint8Array.from(
        atob(
          certPem
            .replace(/-----BEGIN CERTIFICATE-----/g, "")
            .replace(/-----END CERTIFICATE-----/g, "")
            .replace(/\s/g, "")
        ),
        (c) => c.charCodeAt(0)
      )
    );

    const signatureBytes = base64urlDecode(parts[2]);
    const dataBytes = new TextEncoder().encode(parts[0] + "." + parts[1]);

    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signatureBytes, dataBytes);

    if (!valid) {
      console.log("JWT verification failed: invalid signature");
      return null;
    }

    console.log("JWT verification succeeded for user:", payloadJson.sub || payloadJson.email);
    return payloadJson;
  } catch (err) {
    console.error("JWT verification error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log raw request info for debugging webhook delivery
    console.log("gchat-interaction: method=", req.method, "url=", req.url);

    // ── Verify Google Chat webhook authenticity ──
    const authHeader = req.headers.get("Authorization");
    const projectNumber = Deno.env.get("GOOGLE_CLOUD_PROJECT_NUMBER");

    if (projectNumber && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const payload = await verifyGoogleChatToken(token, projectNumber);
      if (!payload) {
        console.error("gchat-interaction: JWT verification FAILED — rejecting request");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (projectNumber && !authHeader) {
      console.error("gchat-interaction: No Authorization header — rejecting request");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (!projectNumber) {
      console.warn("gchat-interaction: GOOGLE_CLOUD_PROJECT_NUMBER not set — skipping webhook verification (INSECURE)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    console.log("gchat-interaction raw body (first 500):", rawBody.substring(0, 500));
    
    const event = JSON.parse(rawBody);
    console.log("gchat-interaction parsed: type=", event.type, "space.type=", event.space?.type, "space.name=", event.space?.name, "user=", event.user?.displayName);

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

    return new Response("{}", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    // Beacon processes async and replies via Google Chat API directly.
    // Return empty JSON object — Google Chat accepts {} as "no synchronous reply"
    if (beaconRes.status === 204 || !text) {
      return new Response("{}", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
