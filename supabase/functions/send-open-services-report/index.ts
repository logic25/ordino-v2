import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Gmail helpers (same pattern as gmail-send) ---

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

function buildRawEmail(from: string, to: string, subject: string, html: string): string {
  const boundary = "boundary_" + Date.now();
  const plainBody = html.replace(/<[^>]*>/g, "");
  const encodedSubject = /[^\x20-\x7E]/.test(subject)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
    : subject;

  const message = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainBody,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${boundary}--`,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendEmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const raw = buildRawEmail(from, to, subject, html);
  const res = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
  const data = await res.json();
  if (data.error) return { success: false, error: data.error.message };
  return { success: true };
}

// --- Goal comparison logic ---

function getGoalMessage(openValue: number, goal: number): { label: string; emoji: string; color: string } {
  if (!goal || goal <= 0) return { label: "No goal set", emoji: "📊", color: "#6b7280" };
  const pct = (openValue / goal) * 100;
  if (pct >= 100) return { label: "Fully loaded — great pipeline this month!", emoji: "🚀", color: "#16a34a" };
  if (pct >= 70) return { label: "On track — solid workload ahead", emoji: "✅", color: "#2563eb" };
  if (pct >= 40) return { label: "Room to grow — consider picking up capacity", emoji: "📈", color: "#d97706" };
  return { label: "Light month — check with leadership on upcoming assignments", emoji: "⚠️", color: "#dc2626" };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function pct(value: number, goal: number): string {
  if (!goal || goal <= 0) return "N/A";
  return Math.round((value / goal) * 100) + "%";
}

// --- Email templates ---

interface PMGroup {
  pmName: string;
  pmEmail: string | null;
  monthlyGoal: number;
  totalValue: number;
  totalServices: number;
  services: {
    projectNumber: string;
    address: string;
    serviceName: string;
    amount: number;
    status: string;
  }[];
}

function buildServicesTable(services: PMGroup["services"]): string {
  const rows = services
    .map(
      (s) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${s.projectNumber}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${s.address}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${s.serviceName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${fmt(s.amount)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-transform:capitalize;">${s.status.replace("_", " ")}</td>
      </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #d1d5db;">Project #</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #d1d5db;">Address</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #d1d5db;">Service</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #d1d5db;">Amount</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #d1d5db;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildPMSection(group: PMGroup): string {
  const goal = getGoalMessage(group.totalValue, group.monthlyGoal);
  return `
    <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#f9fafb;padding:14px 16px;border-bottom:1px solid #e5e7eb;">
        <h3 style="margin:0 0 8px;font-size:16px;color:#111827;">${group.pmName}</h3>
        <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;color:#4b5563;">
          <span><strong>Monthly Goal:</strong> ${group.monthlyGoal ? fmt(group.monthlyGoal) : "Not set"}</span>
          <span><strong>Open Services Value:</strong> ${fmt(group.totalValue)}</span>
          <span><strong>Progress:</strong> ${pct(group.totalValue, group.monthlyGoal)}</span>
          <span><strong>Services:</strong> ${group.totalServices}</span>
        </div>
        <div style="margin-top:8px;padding:6px 12px;border-radius:4px;background:${goal.color}15;border-left:4px solid ${goal.color};font-size:13px;color:${goal.color};">
          ${goal.emoji} ${goal.label}
        </div>
      </div>
      <div style="padding:0 16px 12px;">
        ${buildServicesTable(group.services)}
      </div>
    </div>`;
}

function buildEmailHTML(
  pmGroups: PMGroup[],
  totalServices: number,
  totalValue: number,
  monthLabel: string,
  isAdmin: boolean,
  appUrl: string
): string {
  const pmSections = pmGroups.map(buildPMSection).join("");
  const title = isAdmin
    ? `Team Open Services Report — ${monthLabel}`
    : `Your Open Services — ${monthLabel}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:700px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#065f46,#047857);padding:28px 24px;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">${title}</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Services expected to be completed this month</p>
    </div>

    <!-- Summary -->
    <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;display:flex;gap:32px;">
      <div style="text-align:center;flex:1;">
        <div style="font-size:28px;font-weight:700;color:#065f46;">${totalServices}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">Open Services</div>
      </div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:28px;font-weight:700;color:#065f46;">${fmt(totalValue)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">Total Value</div>
      </div>
      ${isAdmin ? `<div style="text-align:center;flex:1;">
        <div style="font-size:28px;font-weight:700;color:#065f46;">${pmGroups.length}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">Project Managers</div>
      </div>` : ""}
    </div>

    <!-- PM Sections -->
    <div style="padding:20px 24px;">
      ${pmSections}
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <a href="${appUrl}/reports" style="display:inline-block;padding:10px 24px;background:#065f46;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">View in Ordino</a>
      <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">Green Light Expediting • Automated Monthly Report</p>
    </div>
  </div>
</body>
</html>`;
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
    const appUrl = supabaseUrl.replace(".supabase.co", "").includes("lovable")
      ? "https://ordinov3.lovable.app"
      : "https://ordinov3.lovable.app";

    if (!gmailClientId || !gmailClientSecret) {
      return new Response(
        JSON.stringify({ error: "Gmail credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Query open services with project + property info
    const { data: services, error: svcErr } = await supabase
      .from("services")
      .select(`
        id, name, status, fixed_price, total_amount,
        projects!inner (
          id, project_number, name, assigned_pm_id, status, company_id,
          properties ( address )
        )
      `)
      .in("status", ["not_started", "in_progress"]);

    if (svcErr) throw svcErr;
    if (!services || services.length === 0) {
      return new Response(
        JSON.stringify({ message: "No open services found", emails_sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the company_id from the first service
    const companyId = (services[0] as any).projects.company_id;

    // 2. Get all PM profiles
    const pmIds = [...new Set(services.map((s: any) => s.projects.assigned_pm_id).filter(Boolean))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, monthly_goal, user_id")
      .in("id", pmIds);

    // Get emails from auth.users via gmail_connections (profiles don't have email)
    const { data: gmailConns } = await supabase
      .from("gmail_connections")
      .select("user_id, email_address");

    const profileMap = new Map<string, { name: string; email: string | null; goal: number }>();
    for (const p of profiles || []) {
      const conn = gmailConns?.find((g: any) => g.user_id === p.id);
      profileMap.set(p.id, {
        name: p.display_name || "Unknown PM",
        email: conn?.email_address || null,
        goal: Number(p.monthly_goal) || 0,
      });
    }

    // 3. Group services by PM
    const groupMap = new Map<string, PMGroup>();

    for (const svc of services as any[]) {
      const pmId = svc.projects.assigned_pm_id || "unassigned";
      const pm = profileMap.get(pmId);

      if (!groupMap.has(pmId)) {
        groupMap.set(pmId, {
          pmName: pm?.name || "Unassigned",
          pmEmail: pm?.email || null,
          monthlyGoal: pm?.goal || 0,
          totalValue: 0,
          totalServices: 0,
          services: [],
        });
      }

      const group = groupMap.get(pmId)!;
      const amount = Number(svc.fixed_price) || Number(svc.total_amount) || 0;
      group.totalValue += amount;
      group.totalServices += 1;
      group.services.push({
        projectNumber: svc.projects.project_number || "—",
        address: svc.projects.properties?.address || svc.projects.name || "—",
        serviceName: svc.name,
        amount,
        status: svc.status,
      });
    }

    const pmGroups = [...groupMap.entries()].sort((a, b) => a[1].pmName.localeCompare(b[1].pmName));
    const grandTotalServices = services.length;
    const grandTotalValue = pmGroups.reduce((sum, [, g]) => sum + g.totalValue, 0);

    const now = new Date();
    const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    const subject = `Monthly Open Services Report — ${monthLabel}`;

    // 4. Get a Gmail connection from an admin to send emails
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, display_name, user_id")
      .eq("company_id", companyId)
      .in("role", ["admin", "manager"]);

    // Find an admin with a gmail connection to use as sender
    let senderConnection: any = null;
    let senderEmail = "";
    const adminEmails: string[] = [];

    for (const ap of adminProfiles || []) {
      const conn = gmailConns?.find((g: any) => g.user_id === ap.id);
      if (conn) {
        adminEmails.push(conn.email_address);
        if (!senderConnection) {
          const { data: fullConn } = await supabase
            .from("gmail_connections")
            .select("*")
            .eq("user_id", ap.id)
            .single();
          if (fullConn) {
            senderConnection = fullConn;
            senderEmail = fullConn.email_address;
          }
        }
      }
    }

    if (!senderConnection) {
      return new Response(
        JSON.stringify({ error: "No admin Gmail connection found to send emails" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if needed
    let accessToken = senderConnection.access_token;
    const tokenExpiry = new Date(senderConnection.token_expires_at || 0);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(
        senderConnection.refresh_token,
        gmailClientId,
        gmailClientSecret
      );
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Token refresh failed" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      await supabase
        .from("gmail_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", senderConnection.id);
    }

    const results: { to: string; type: string; success: boolean; error?: string }[] = [];

    // 5. Send PM-specific emails
    for (const [pmId, group] of pmGroups) {
      if (pmId === "unassigned" || !group.pmEmail) continue;
      // Skip if this PM is also an admin (they'll get the full version)
      if (adminEmails.includes(group.pmEmail)) continue;

      const html = buildEmailHTML([group], group.totalServices, group.totalValue, monthLabel, false, appUrl);
      const result = await sendEmail(accessToken, senderEmail, group.pmEmail, subject, html);
      results.push({ to: group.pmEmail, type: "pm", ...result });
    }

    // 6. Send admin/team email
    const allGroups = pmGroups.map(([, g]) => g);
    const adminHtml = buildEmailHTML(allGroups, grandTotalServices, grandTotalValue, monthLabel, true, appUrl);

    for (const adminEmail of adminEmails) {
      const result = await sendEmail(accessToken, senderEmail, adminEmail, subject, adminHtml);
      results.push({ to: adminEmail, type: "admin", ...result });
    }

    return new Response(
      JSON.stringify({
        success: true,
        month: monthLabel,
        total_services: grandTotalServices,
        total_value: grandTotalValue,
        emails_sent: results.filter((r) => r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Report error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
