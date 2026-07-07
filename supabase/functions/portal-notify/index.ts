// Reads unsent portal_notifications rows, emails the client user (via existing
// gmail-send function), and marks them sent. Idempotent: only processes rows
// where email_sent_at IS NULL and matches one of the 4 emailable types.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAILABLE = new Set(["blocked", "objections", "approved", "permit_issued"]);
const PORTAL_URL = "https://ordinopm.com/portal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Grab pending notifications (last 24h, unsent, emailable type)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: notifs, error } = await supabase
    .from("portal_notifications")
    .select("id, user_id, project_id, type, title, message")
    .is("email_sent_at", null)
    .in("type", Array.from(EMAILABLE))
    .gte("created_at", since)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;

  for (const n of notifs ?? []) {
    // Resolve recipient email via auth.users through profiles
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, first_name, portal_role")
      .eq("id", n.user_id)
      .maybeSingle();

    // Skip if this user isn't a portal client
    if (!prof || prof.portal_role !== "client") {
      await supabase.from("portal_notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", n.id);
      continue;
    }

    const { data: userRow } = await supabase.auth.admin.getUserById(n.user_id);
    const email = userRow?.user?.email;
    if (!email) {
      failed++;
      continue;
    }

    const badge = n.type === "blocked" ? "#dc2626"
      : n.type === "objections" ? "#f59e0b"
      : n.type === "approved" ? "#16a34a"
      : "#0ea5e9";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <div style="background:#1e293b;padding:20px 24px;border-radius:12px 12px 0 0">
          <h1 style="color:#f59e0b;margin:0;font-size:20px">Ordino Client Portal</h1>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <div style="display:inline-block;background:${badge};color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${n.type.replace("_", " ")}</div>
          <h2 style="font-size:18px;color:#1e293b;margin:12px 0 8px">${n.title}</h2>
          <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">${n.message ?? ""}</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${PORTAL_URL}/projects/${n.project_id}" style="background:#1e293b;color:#f59e0b;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
              View project
            </a>
          </div>
          <p style="font-size:11px;color:#94a3b8;margin:16px 0 0;text-align:center">
            Ordino Client Portal · Green Light Expediting
          </p>
        </div>
      </div>`;

    try {
      const { error: sendErr } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: email,
          subject: `[Ordino] ${n.title}`,
          html_body: html,
        },
      });
      if (sendErr) {
        console.error("gmail-send failed", sendErr);
        failed++;
        continue;
      }
      await supabase
        .from("portal_notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", n.id);
      sent++;
    } catch (e) {
      console.error("send exception", e);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: (notifs ?? []).length, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
