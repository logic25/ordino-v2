import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ActionItemPayload {
  action_item_id: string;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action_item_id } = (await req.json()) as ActionItemPayload;
    if (!action_item_id) {
      return new Response(
        JSON.stringify({ error: "action_item_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch action item with relations
    const { data: item, error: itemErr } = await supabase
      .from("project_action_items")
      .select(`
        *,
        assignee:profiles!project_action_items_assigned_to_fkey(display_name, first_name, last_name),
        assigner:profiles!project_action_items_assigned_by_fkey(display_name, first_name, last_name),
        projects!project_action_items_project_id_fkey(name, project_number)
      `)
      .eq("id", action_item_id)
      .single();

    if (itemErr || !item) {
      return new Response(
        JSON.stringify({ error: "Action item not found", detail: itemErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if GChat is enabled for this company
    const { data: company } = await supabase
      .from("companies")
      .select("settings")
      .eq("id", item.company_id)
      .single();

    const settings = (company?.settings as Record<string, any>) || {};
    if (!settings.gchat_enabled || !settings.gchat_space_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "GChat not enabled or no space configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the creator's Gmail connection for OAuth
    const creatorId = item.assigned_by;
    const { data: connection, error: connErr } = await supabase
      .from("gmail_connections")
      .select("access_token, refresh_token, token_expires_at")
      .eq("user_id", creatorId)
      .single();

    if (connErr || !connection) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Creator has no Gmail connection" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired, refresh if needed
    let accessToken = connection.access_token;
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : new Date(0);
    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(connection.refresh_token, clientId, clientSecret, supabase, creatorId);
    }

    const project = (item as any).projects;
    const assigneeName = item.assignee?.display_name || item.assignee?.first_name || "Unassigned";
    const assignerName = item.assigner?.display_name || item.assigner?.first_name || "Someone";
    const projectLabel = project?.project_number
      ? `${project.project_number} – ${project.name || ""}`
      : project?.name || "Unknown Project";

    const appUrl = Deno.env.get("APP_URL") || "https://ordinov3.lovable.app";

    // Build Card V2 message
    const cardMessage = {
      cardsV2: [
        {
          cardId: `action-item-${item.id}`,
          card: {
            header: {
              title: item.title,
              subtitle: `${item.priority === "urgent" ? "🔴 URGENT – " : ""}${projectLabel}`,
              imageUrl: "https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/task_alt/default/48px.svg",
              imageType: "CIRCLE",
            },
            sections: [
              {
                widgets: [
                  ...(item.description
                    ? [{ textParagraph: { text: item.description } }]
                    : []),
                  {
                    decoratedText: {
                      topLabel: "Assigned to",
                      text: assigneeName,
                      startIcon: { knownIcon: "PERSON" },
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: "Assigned by",
                      text: assignerName,
                      startIcon: { knownIcon: "PERSON" },
                    },
                  },
                  ...(item.due_date
                    ? [
                        {
                          decoratedText: {
                            topLabel: "Due date",
                            text: item.due_date,
                            startIcon: { knownIcon: "CLOCK" },
                          },
                        },
                      ]
                    : []),
                ],
              },
              {
                widgets: [
                  {
                    buttonList: {
                      buttons: [
                        {
                          text: "✅ Mark Done",
                          onClick: {
                            action: {
                              function: "mark_done",
                              parameters: [
                                { key: "action_item_id", value: item.id },
                              ],
                            },
                          },
                        },
                        {
                          text: "Open in Ordino",
                          onClick: {
                            openLink: {
                              url: `${appUrl}/projects/${item.project_id}`,
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    // Post to Google Chat
    const spaceId = settings.gchat_space_id;
    const chatUrl = `https://chat.googleapis.com/v1/spaces/${spaceId}/messages`;

    const chatRes = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cardMessage),
    });

    if (!chatRes.ok) {
      const errBody = await chatRes.text();
      console.error("GChat API error:", chatRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "GChat API error", status: chatRes.status, detail: errBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatData = await chatRes.json();

    // Store thread ID on the action item
    const threadName = chatData.thread?.name || null;
    if (threadName) {
      await supabase
        .from("project_action_items")
        .update({
          gchat_thread_id: threadName,
          gchat_space_id: spaceId,
        } as any)
        .eq("id", item.id);
    }

    return new Response(
      JSON.stringify({ success: true, thread_id: threadName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-gchat-action-item error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
