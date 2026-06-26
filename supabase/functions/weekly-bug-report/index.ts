import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Cron-only: authenticate via x-cron-secret (env CRON_SECRET or vault `cron_secret`,
    // covering both managed-env and pg_net callers). Fails closed when no secret is set.
    const provided = req.headers.get("x-cron-secret") || "";
    const acceptable = new Set<string>();
    const envSecret = Deno.env.get("CRON_SECRET");
    if (envSecret) acceptable.add(envSecret);
    const { data: vaultRow } = await supabase.schema("vault" as any)
      .from("decrypted_secrets").select("decrypted_secret").eq("name", "cron_secret").maybeSingle();
    const vaultSecret = (vaultRow as any)?.decrypted_secret;
    if (vaultSecret) acceptable.add(vaultSecret);
    if (!provided || !acceptable.has(provided)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoIso = weekAgo.toISOString();

    // Get all companies that have bugs
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name");

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: "No companies" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const company of companies) {
      // Get bugs submitted this week
      const { data: submittedThisWeek } = await supabase
        .from("feature_requests")
        .select("*")
        .eq("company_id", company.id)
        .eq("category", "bug_report")
        .gte("created_at", weekAgoIso);

      // Get bugs resolved this week
      const { data: resolvedThisWeek } = await supabase
        .from("feature_requests")
        .select("*")
        .eq("company_id", company.id)
        .eq("category", "bug_report")
        .eq("status", "resolved")
        .gte("resolved_at", weekAgoIso);

      // Get still open bugs
      const { data: openBugs } = await supabase
        .from("feature_requests")
        .select("*")
        .eq("company_id", company.id)
        .eq("category", "bug_report")
        .in("status", ["open", "in_progress", "ready_for_review"]);

      const submitted = submittedThisWeek || [];
      const resolved = resolvedThisWeek || [];
      const open = openBugs || [];

      // Skip if no activity
      if (submitted.length === 0 && resolved.length === 0 && open.length === 0) continue;

      // Calculate avg resolution time
      const resolutionTimes = resolved
        .filter((b: any) => b.resolved_at && b.created_at)
        .map((b: any) => (new Date(b.resolved_at).getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60));
      const avgResolutionHours = resolutionTimes.length > 0
        ? Math.round(resolutionTimes.reduce((a: number, b: number) => a + b, 0) / resolutionTimes.length)
        : null;

      // Top 3 by severity
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const topBugs = [...open]
        .sort((a: any, b: any) => (severityOrder[a.ai_severity || a.priority] ?? 9) - (severityOrder[b.ai_severity || b.priority] ?? 9))
        .slice(0, 3);

      // Aggregate files changed
      const filesCounts: Record<string, number> = {};
      for (const b of resolved) {
        const files = b.files_changed || b.ai_suggested_files || [];
        for (const f of files) {
          filesCounts[f] = (filesCounts[f] || 0) + 1;
        }
      }
      const topFiles = Object.entries(filesCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Page frequency
      const pageCounts: Record<string, number> = {};
      for (const b of submitted) {
        const match = b.title?.match(/^\[([^\]]+)\]/);
        if (match) pageCounts[match[1]] = (pageCounts[match[1]] || 0) + 1;
      }
      const hotPages = Object.entries(pageCounts)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1]);

      // Build HTML email
      const weekEndDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#fff;padding:20px 32px;border-bottom:3px solid #22c55e;">
    <h1 style="margin:0;font-size:20px;color:#18181b;">🐛 Weekly Bug Report</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#71717a;">Week ending ${weekEndDate}</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    <!-- Stats Grid -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="text-align:center;padding:16px;background:#fef2f2;border-radius:8px;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#ef4444;">${submitted.length}</div>
          <div style="font-size:11px;color:#71717a;margin-top:4px;">Submitted</div>
        </td>
        <td width="8"></td>
        <td style="text-align:center;padding:16px;background:#f0fdf4;border-radius:8px;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#22c55e;">${resolved.length}</div>
          <div style="font-size:11px;color:#71717a;margin-top:4px;">Fixed</div>
        </td>
        <td width="8"></td>
        <td style="text-align:center;padding:16px;background:#fefce8;border-radius:8px;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">${open.length}</div>
          <div style="font-size:11px;color:#71717a;margin-top:4px;">Still Open</div>
        </td>
        <td width="8"></td>
        <td style="text-align:center;padding:16px;background:#eff6ff;border-radius:8px;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#3b82f6;">${avgResolutionHours !== null ? avgResolutionHours + "h" : "—"}</div>
          <div style="font-size:11px;color:#71717a;margin-top:4px;">Avg Fix Time</div>
        </td>
      </tr>
    </table>

    ${topBugs.length > 0 ? `
    <h3 style="font-size:14px;color:#18181b;margin:0 0 12px;">Top Open Bugs</h3>
    <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:6px;font-size:13px;margin-bottom:20px;">
      <tr style="background:#f4f4f5;">
        <th align="left" style="font-weight:600;color:#71717a;">Bug</th>
        <th align="left" style="font-weight:600;color:#71717a;width:80px;">Severity</th>
        <th align="left" style="font-weight:600;color:#71717a;width:80px;">Status</th>
      </tr>
      ${topBugs.map((b: any) => `
      <tr style="border-top:1px solid #e4e4e7;">
        <td style="color:#18181b;">${b.title}</td>
        <td><span style="background:${b.ai_severity === "critical" || b.priority === "critical" ? "#fef2f2;color:#ef4444" : b.ai_severity === "high" || b.priority === "high" ? "#fff7ed;color:#f97316" : "#fefce8;color:#eab308"};padding:2px 8px;border-radius:4px;font-size:11px;">${(b.ai_severity || b.priority).toUpperCase()}</span></td>
        <td style="color:#71717a;">${b.status}</td>
      </tr>`).join("")}
    </table>` : ""}

    ${hotPages.length > 0 ? `
    <h3 style="font-size:14px;color:#18181b;margin:0 0 8px;">⚠️ Pattern Alert</h3>
    <p style="font-size:13px;color:#71717a;margin:0 0 16px;">
      ${hotPages.map(([page, count]) => `${count} bugs in <strong>${page}</strong> this week`).join(", ")} — may need deeper review.
    </p>` : ""}

    ${topFiles.length > 0 ? `
    <h3 style="font-size:14px;color:#18181b;margin:0 0 8px;">Files Changed This Week</h3>
    <p style="font-size:12px;color:#71717a;font-family:monospace;margin:0 0 16px;">
      ${topFiles.map(([file, count]) => `${file} (${count}x)`).join("<br>")}
    </p>` : ""}
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f4f4f5;text-align:center;">
    <p style="margin:0;font-size:11px;color:#a1a1aa;">Ordino Bug Tracker • Automated Weekly Report</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

      // Find admin users with gmail connections to send from
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .eq("company_id", company.id);

      if (!adminRoles || adminRoles.length === 0) continue;

      // Get admin profiles with email
      const adminUserIds = adminRoles.map((r: any) => r.user_id);
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, display_name")
        .in("user_id", adminUserIds);

      if (!adminProfiles || adminProfiles.length === 0) continue;

      // Find a gmail connection to send from
      const adminProfileIds = adminProfiles.map((p: any) => p.id);
      const { data: gmailConn } = await supabase
        .from("gmail_connections")
        .select("user_id, email_address")
        .in("user_id", adminProfileIds)
        .limit(1)
        .single();

      if (!gmailConn) continue;

      // Get admin emails to send to
      const toEmails = adminProfiles
        .map((p: any) => p.email)
        .filter(Boolean)
        .join(", ");

      if (!toEmails) continue;

      // Send via gmail-send
      await supabase.functions.invoke("gmail-send", {
        body: {
          user_id: gmailConn.user_id,
          to: toEmails,
          subject: `Ordino Weekly Bug Report — W/E ${weekEndDate}`,
          html_body: html,
        },
      });

      console.log(`Weekly bug report sent for company ${company.name} to ${toEmails}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Weekly bug report error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
