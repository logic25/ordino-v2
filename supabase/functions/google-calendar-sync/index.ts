import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data;
}

async function getAccessToken(
  supabaseAdmin: any,
  connection: any,
  clientId: string,
  clientSecret: string
) {
  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt > new Date(Date.now() + 60_000)) {
    return connection.access_token;
  }
  const tokens = await refreshAccessToken(connection.refresh_token, clientId, clientSecret);
  await supabaseAdmin
    .from("gmail_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("id", connection.id);
  return tokens.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID")!;
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;

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

    const body = await req.json();
    const { action } = body;

    // For create/update/delete, allow local-only when Gmail isn't connected
    let accessToken: string | null = null;
    if (connection) {
      try {
        accessToken = await getAccessToken(supabaseAdmin, connection, gmailClientId, gmailClientSecret);
      } catch (e) {
        console.error("Token refresh failed, proceeding local-only:", e.message);
        accessToken = null;
      }
    }

    // Sync requires Google connection
    if (action === "sync" && !accessToken) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected. Please connect Gmail first (with Calendar scope)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SYNC: Pull events from Google Calendar ───
    if (action === "sync") {
      const { time_min, time_max } = body;
      const now = new Date();
      const minTime = time_min || new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const maxTime = time_max || new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

      const params = new URLSearchParams({
        timeMin: minTime,
        timeMax: maxTime,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });

      const resp = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Calendar API error:", resp.status, errText);
        return new Response(
          JSON.stringify({ error: `Calendar API error: ${resp.status}`, needs_reauth: resp.status === 403 }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const calData = await resp.json();
      const events = calData.items || [];
      let synced = 0;

      for (const event of events) {
        if (event.status === "cancelled") continue;

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        const allDay = !event.start?.dateTime;

        if (!startTime || !endTime) continue;

        const { error: upsertErr } = await supabaseAdmin
          .from("calendar_events")
          .upsert(
            {
              company_id: profile.company_id,
              user_id: profile.id,
              google_event_id: event.id,
              google_calendar_id: "primary",
              title: event.summary || "(No title)",
              description: event.description || null,
              location: event.location || null,
              start_time: allDay ? `${startTime}T00:00:00Z` : startTime,
              end_time: allDay ? `${endTime}T00:00:00Z` : endTime,
              all_day: allDay,
              status: event.status || "confirmed",
              sync_status: "synced",
              last_synced_at: new Date().toISOString(),
              metadata: {
                html_link: event.htmlLink,
                creator: event.creator,
                attendees: event.attendees,
                recurrence: event.recurrence,
              },
            },
            { onConflict: "company_id,google_event_id" }
          );

        if (upsertErr) {
          console.error("Upsert error for event", event.id, upsertErr.message);
        } else {
          synced++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, synced, total: events.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CREATE: Push a new event to Google Calendar ───
    if (action === "create") {
      const { title, description, location, start_time, end_time, all_day, event_type, project_id, property_id, client_id, application_id, attendee_ids } = body;

      let googleEventId: string | null = null;
      let htmlLink: string | null = null;

      // Push to Google Calendar if connected
      if (accessToken) {
        const gcalEvent: any = {
          summary: title,
          description: description || "",
          location: location || "",
        };

        if (all_day) {
          gcalEvent.start = { date: start_time.split("T")[0] };
          gcalEvent.end = { date: end_time.split("T")[0] };
        } else {
          gcalEvent.start = { dateTime: start_time, timeZone: "America/New_York" };
          gcalEvent.end = { dateTime: end_time, timeZone: "America/New_York" };
        }

        const resp = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gcalEvent),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error("Google Calendar create failed, saving locally:", errText);
        } else {
          const created = await resp.json();
          googleEventId = created.id;
          htmlLink = created.htmlLink;
        }
      }

      const { data: dbEvent, error: dbErr } = await supabaseAdmin
        .from("calendar_events")
        .insert({
          company_id: profile.company_id,
          user_id: profile.id,
          google_event_id: googleEventId,
          title,
          description,
          location,
          start_time,
          end_time,
          all_day: all_day || false,
          event_type: event_type || "general",
          project_id: project_id || null,
          property_id: property_id || null,
          client_id: client_id || null,
          application_id: application_id || null,
          status: "confirmed",
          sync_status: googleEventId ? "synced" : "local",
          last_synced_at: googleEventId ? new Date().toISOString() : null,
          metadata: { ...(htmlLink ? { html_link: htmlLink } : {}), ...(attendee_ids?.length ? { attendee_ids } : {}) },
        })
        .select()
        .single();

      if (dbErr) {
        return new Response(
          JSON.stringify({ error: dbErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Notify attendees (in-app + email) ──
      if (attendee_ids?.length) {
        const creatorProfile = (await supabaseAdmin
          .from("profiles")
          .select("display_name, user_id")
          .eq("id", profile.id)
          .single()).data;

        const { data: attendeeProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name, user_id")
          .in("id", attendee_ids);

        // Resolve emails from auth.users for attendees
        const attendeeEmails: Record<string, string> = {};
        for (const att of (attendeeProfiles || [])) {
          if (att.user_id) {
            try {
              const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(att.user_id);
              if (authUser?.email) attendeeEmails[att.id] = authUser.email;
            } catch (_) { /* skip */ }
          }
        }

        const formatDate = (iso: string, isAllDay: boolean) => {
          const d = new Date(iso);
          if (isAllDay) return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          return d.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
        };

        for (const att of (attendeeProfiles || [])) {
          if (att.id === profile.id) continue; // don't notify creator

          // In-app notification
          await supabaseAdmin.from("notifications").insert({
            company_id: profile.company_id,
            user_id: att.id,
            type: "calendar_event",
            title: "New Calendar Event",
            body: `${creatorProfile?.display_name || "Someone"} invited you to: ${title}`,
            link: "/calendar",
            metadata: { event_id: dbEvent.id, start_time, event_type: event_type || "general" },
          });

          // Email notification
          const attEmail = attendeeEmails[att.id];
          if (attEmail) {
            const startFormatted = formatDate(start_time, all_day || false);
            const endFormatted = formatDate(end_time, all_day || false);
            const htmlBody = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 20px;">
  <p>Hi ${att.display_name || "there"},</p>
  <p><strong>${creatorProfile?.display_name || "A team member"}</strong> has invited you to an event:</p>
  <div style="margin: 16px 0; padding: 16px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid #333;">
    <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold;">${title}</p>
    <p style="margin: 0 0 4px;">📅 ${startFormatted}${all_day ? "" : ` — ${endFormatted}`}</p>
    ${location ? `<p style="margin: 0 0 4px;">📍 ${location}</p>` : ""}
    ${description ? `<p style="margin: 8px 0 0; color: #555;">${description}</p>` : ""}
  </div>
  <p>Thanks,<br/>Ordino</p>
</body></html>`.trim();

            try {
              await supabaseAdmin.functions.invoke("gmail-send", {
                body: {
                  to: attEmail,
                  subject: `Calendar: ${title} — ${startFormatted}`,
                  html_body: htmlBody,
                },
              });
            } catch (emailErr) {
              console.error("Failed to send calendar email to", attEmail, emailErr);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, event: dbEvent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── UPDATE: Update an existing event ───
    if (action === "update") {
      const { event_id, title, description, location, start_time, end_time, all_day, event_type, project_id, property_id, client_id, attendee_ids } = body;

      const { data: existing } = await supabaseAdmin
        .from("calendar_events")
        .select("google_event_id, metadata")
        .eq("id", event_id)
        .eq("company_id", profile.company_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing.google_event_id && accessToken) {
        const gcalEvent: any = { summary: title };
        if (description !== undefined) gcalEvent.description = description;
        if (location !== undefined) gcalEvent.location = location;
        if (all_day) {
          gcalEvent.start = { date: start_time.split("T")[0] };
          gcalEvent.end = { date: end_time.split("T")[0] };
        } else {
          gcalEvent.start = { dateTime: start_time, timeZone: "America/New_York" };
          gcalEvent.end = { dateTime: end_time, timeZone: "America/New_York" };
        }

        const resp = await fetch(`${CALENDAR_API}/calendars/primary/events/${existing.google_event_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gcalEvent),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error("Update Google Calendar error:", errText);
        } else {
          await resp.text();
        }
      }

      const updates: any = { title, start_time, end_time, updated_at: new Date().toISOString() };
      if (description !== undefined) updates.description = description;
      if (location !== undefined) updates.location = location;
      if (all_day !== undefined) updates.all_day = all_day;
      if (event_type !== undefined) updates.event_type = event_type;
      if (project_id !== undefined) updates.project_id = project_id;
      if (property_id !== undefined) updates.property_id = property_id;
      if (client_id !== undefined) updates.client_id = client_id;
      if (attendee_ids !== undefined) {
        const existingMeta = (existing as any).metadata || {};
        updates.metadata = { ...existingMeta, attendee_ids };
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("calendar_events")
        .update(updates)
        .eq("id", event_id)
        .select()
        .single();

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, event: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DELETE: Remove an event ───
    if (action === "delete") {
      const { event_id } = body;

      const { data: existing } = await supabaseAdmin
        .from("calendar_events")
        .select("google_event_id")
        .eq("id", event_id)
        .eq("company_id", profile.company_id)
        .single();

      if (existing?.google_event_id && accessToken) {
        const resp = await fetch(
          `${CALENDAR_API}/calendars/primary/events/${existing.google_event_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        await resp.text();
      }

      await supabaseAdmin
        .from("calendar_events")
        .delete()
        .eq("id", event_id)
        .eq("company_id", profile.company_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Calendar sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
