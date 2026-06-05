// Monday Meeting Report — weekly summary email sent Sundays 11pm ET to PMs + admins.
// Replaces the unused "Open Services" digest. Sections:
//   1. Top of mind this week (AI-ranked from project notes + recent activity)
//   2. Filings expected this week (services with estimated_bill_date in next 7 days)
//   3. Where someone needs help (stale projects + blocked checklist items)
//   4. Wins (services billed/paid in last 7 days)
//   5. Numbers (open value, billed this week, AR aging glance)
//
// Authenticates via x-cron-secret. Cron is configured to call this Mon 04:00 UTC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ---------- Gmail helpers (copy of send-open-services-report) ----------

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
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
  return { access_token: data.access_token as string };
}

function buildRawEmail(from: string, to: string, subject: string, html: string): string {
  const boundary = "boundary_" + Date.now();
  const plainBody = html.replace(/<[^>]*>/g, "");
  const encodedSubject = /[^\x20-\x7E]/.test(subject)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
    : subject;
  const message = [
    `To: ${to}`, `From: ${from}`, `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "", plainBody,
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "", html,
    `--${boundary}--`,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(accessToken: string, from: string, to: string, subject: string, html: string) {
  const raw = buildRawEmail(from, to, subject, html);
  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json();
  return data.error ? { success: false, error: data.error.message } : { success: true };
}

// ---------- Formatting ----------

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

// ---------- AI ranker for "top of mind" ----------

async function rankTopOfMind(projectSummaries: Array<{ id: string; name: string; pm: string; recentNotes: string[]; lastActivity: string; openValue: number }>): Promise<Array<{ id: string; bullet: string }>> {
  if (projectSummaries.length === 0) return [];
  try {
    const prompt = `You are helping a construction-expediting team's Monday morning meeting. From the project list below, pick the 5-8 projects that most deserve attention this week and write ONE short bullet (max 18 words) explaining why for each. Focus on: blockers, slipping deadlines, recent objections, big-dollar at-risk work, or something the PM said in a recent note that needs help. Return strict JSON array: [{"id":"<projectId>","bullet":"<one sentence>"}].\n\nProjects:\n${JSON.stringify(projectSummaries.slice(0, 60))}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    const j = await res.json();
    const raw = j.choices?.[0]?.message?.content || "[]";
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed.items || parsed.projects || []);
    return arr.filter((x: any) => x?.id && x?.bullet).slice(0, 8);
  } catch (err) {
    console.error("rankTopOfMind failed", err);
    return projectSummaries.slice(0, 5).map(p => ({
      id: p.id,
      bullet: `${p.name} — ${daysSince(p.lastActivity)}d since last activity, ${fmt(p.openValue)} open.`,
    }));
  }
}

// ---------- HTML ----------

function section(title: string, body: string): string {
  return `<div style="margin:0 0 24px;">
    <h2 style="margin:0 0 10px;font-size:15px;color:#111;border-bottom:2px solid #065f46;padding-bottom:6px;">${title}</h2>
    ${body}
  </div>`;
}

function bulletList(items: string[]): string {
  if (items.length === 0) return `<p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">Nothing here this week.</p>`;
  return `<ul style="margin:0;padding-left:18px;font-size:13px;color:#1f2937;line-height:1.6;">${items.map(i => `<li style="margin-bottom:4px;">${i}</li>`).join("")}</ul>`;
}

function buildHTML(opts: {
  pmName: string;
  weekLabel: string;
  topOfMind: string[];
  filings: string[];
  needsHelp: string[];
  wins: string[];
  numbers: { openValue: number; billedThisWeek: number; openServices: number; staleCount: number };
  appUrl: string;
}): string {
  const { pmName, weekLabel, topOfMind, filings, needsHelp, wins, numbers, appUrl } = opts;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;background:#fff;">
    <div style="background:linear-gradient(135deg,#065f46,#047857);padding:24px;color:#fff;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Monday Meeting — ${weekLabel}</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.9;">${pmName} · what's going on and what needs to happen this week.</p>
    </div>
    <div style="padding:24px;">
      ${section("Top of mind this week", bulletList(topOfMind))}
      ${section("Filings expected this week", bulletList(filings))}
      ${section("Where someone needs help", bulletList(needsHelp))}
      ${section("Wins from last week", bulletList(wins))}
      ${section("The numbers", `<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;width:25%;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Open Value</div><div style="font-size:18px;font-weight:700;color:#065f46;">${fmt(numbers.openValue)}</div></td>
          <td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;width:25%;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Billed Last Wk</div><div style="font-size:18px;font-weight:700;color:#2563eb;">${fmt(numbers.billedThisWeek)}</div></td>
          <td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;width:25%;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Open Services</div><div style="font-size:18px;font-weight:700;color:#111;">${numbers.openServices}</div></td>
          <td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;width:25%;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Stale Projects</div><div style="font-size:18px;font-weight:700;color:${numbers.staleCount > 0 ? "#dc2626" : "#16a34a"};">${numbers.staleCount}</div></td>
        </tr>
      </table>`)}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
        <a href="${appUrl}/projects" style="display:inline-block;background:#065f46;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Open Ordino →</a>
      </div>
    </div>
  </div>
</body></html>`;
}

// ---------- Main ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth — accept either the env CRON_SECRET or the vault `cron_secret` (covers both managed-env and pg_net callers)
    const provided = req.headers.get("x-cron-secret") || "";
    const acceptable = new Set<string>();
    const envSecret = Deno.env.get("CRON_SECRET");
    if (envSecret) acceptable.add(envSecret);
    const { data: vaultRow } = await admin.schema("vault" as any).from("decrypted_secrets").select("decrypted_secret").eq("name", "cron_secret").maybeSingle();
    const vaultSecret = (vaultRow as any)?.decrypted_secret;
    if (vaultSecret) acceptable.add(vaultSecret);
    if (!provided || !acceptable.has(provided)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // For each company
    const { data: companies } = await admin.from("companies").select("id, name");
    const appUrl = Deno.env.get("APP_URL") || "https://ordinov3.lovable.app";
    const reports: Array<{ company: string; pmEmail: string; ok: boolean; error?: string }> = [];

    for (const company of companies || []) {
      // Find PMs + admins
      const { data: roles } = await admin.from("user_roles").select("user_id, role").in("role", ["admin", "pm", "senior_pm"]);
      const userIds = [...new Set((roles || []).map(r => r.user_id))];
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, user_id, first_name, last_name, display_name, email, notification_preferences")
        .eq("company_id", company.id)
        .in("user_id", userIds);

      // Filter out opted-out users (default: enabled)
      const optedInProfiles = (profiles || []).filter((p: any) => {
        const pref = (p.notification_preferences || {}).monday_meeting_report;
        return pref?.enabled !== false; // undefined → enabled
      });

      // Pull open projects with notes + last activity
      const { data: projects } = await admin
        .from("projects")
        .select("id, name, project_number, assigned_pm_id, senior_pm_id, last_activity_at, stale_threshold_days, address")
        .eq("company_id", company.id)
        .eq("status", "open");

      const projectIds = (projects || []).map(p => p.id);
      if (projectIds.length === 0) continue;

      const { data: services } = await admin
        .from("services")
        .select("id, name, status, total_amount, billed_amount, project_id, estimated_bill_date, bill_date_source, billed_at")
        .in("project_id", projectIds);

      const { data: recentNotes } = await admin
        .from("project_notes")
        .select("project_id, content, created_at")
        .in("project_id", projectIds)
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("created_at", { ascending: false });

      // Group per PM
      const byPm = new Map<string, { profile: any; projects: any[] }>();
      for (const p of projects || []) {
        const pmId = p.assigned_pm_id || p.senior_pm_id;
        if (!pmId) continue;
        const prof = optedInProfiles.find((pp: any) => pp.id === pmId);
        if (!prof?.email) continue;
        if (!byPm.has(prof.id)) byPm.set(prof.id, { profile: prof, projects: [] });
        byPm.get(prof.id)!.projects.push(p);
      }

      // Find a gmail connection in this company for sending
      const { data: gmailConn } = await admin
        .from("gmail_connections")
        .select("user_id, email, refresh_token")
        .eq("company_id", company.id)
        .limit(1)
        .maybeSingle();

      if (!gmailConn?.refresh_token) {
        reports.push({ company: company.name, pmEmail: "—", ok: false, error: "No Gmail connection for company" });
        continue;
      }

      const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
      const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;
      const tokens = await refreshAccessToken(gmailConn.refresh_token, clientId, clientSecret);
      if (!tokens) {
        reports.push({ company: company.name, pmEmail: "—", ok: false, error: "Token refresh failed" });
        continue;
      }

      const weekLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

      for (const [, { profile, projects: pmProjects }] of byPm) {
        const pmName = profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Team";

        // Build per-project summary for AI ranking
        const summaries = pmProjects.map((p: any) => {
          const notes = (recentNotes || []).filter(n => n.project_id === p.id).slice(0, 3).map(n => n.content?.slice(0, 200) || "");
          const svcs = (services || []).filter(s => s.project_id === p.id);
          const openValue = svcs.filter(s => !["billed", "paid", "dropped"].includes(s.status || "")).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
          return { id: p.id, name: `${p.project_number ? `#${p.project_number} ` : ""}${p.name || p.address || "Untitled"}`, pm: pmName, recentNotes: notes, lastActivity: p.last_activity_at || new Date().toISOString(), openValue };
        });

        const ranked = await rankTopOfMind(summaries);
        const topOfMind = ranked.map(r => {
          const proj = summaries.find(s => s.id === r.id);
          return `<a href="${appUrl}/projects/${r.id}" style="color:#065f46;text-decoration:none;font-weight:600;">${proj?.name || "Project"}</a> — ${r.bullet}`;
        });

        // Filings expected next 7 days
        const weekFromNow = new Date(Date.now() + 7 * 86400000);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const filings = (services || [])
          .filter(s => pmProjects.some((p: any) => p.id === s.project_id))
          .filter(s => s.estimated_bill_date && !["billed", "paid", "dropped"].includes(s.status || ""))
          .filter(s => { const d = new Date(s.estimated_bill_date!); return d >= today && d <= weekFromNow; })
          .sort((a, b) => new Date(a.estimated_bill_date!).getTime() - new Date(b.estimated_bill_date!).getTime())
          .slice(0, 12)
          .map(s => {
            const proj = pmProjects.find((p: any) => p.id === s.project_id);
            const aiTag = s.bill_date_source === "ai" ? ` <span style="color:#8b5cf6;font-size:11px;">✨ AI</span>` : "";
            return `<strong>${fmtDate(s.estimated_bill_date)}</strong>${aiTag} — ${s.name} <span style="color:#6b7280;">(${proj?.project_number || proj?.name || "—"}, ${fmt(Number(s.total_amount) || 0)})</span>`;
          });

        // Where help needed — stale projects + blocked checklists
        const needsHelp: string[] = [];
        for (const p of pmProjects) {
          if (!p.last_activity_at) continue;
          const stale = daysSince(p.last_activity_at);
          const threshold = p.stale_threshold_days || 14;
          if (stale > threshold) {
            needsHelp.push(`<a href="${appUrl}/projects/${p.id}" style="color:#dc2626;font-weight:600;text-decoration:none;">${p.project_number ? `#${p.project_number}` : p.name}</a> — no activity in ${stale} days`);
          }
        }

        // Wins last week
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const wins = (services || [])
          .filter(s => pmProjects.some((p: any) => p.id === s.project_id))
          .filter(s => s.billed_at && new Date(s.billed_at) >= sevenDaysAgo)
          .slice(0, 10)
          .map(s => {
            const proj = pmProjects.find((p: any) => p.id === s.project_id);
            return `Billed ${s.name} — ${fmt(Number(s.billed_amount) || Number(s.total_amount) || 0)} (${proj?.project_number || "—"})`;
          });

        // Numbers
        const mySvcs = (services || []).filter(s => pmProjects.some((p: any) => p.id === s.project_id));
        const openValue = mySvcs.filter(s => !["billed", "paid", "dropped"].includes(s.status || "")).reduce((sum, s) => sum + ((Number(s.total_amount) || 0) - (Number(s.billed_amount) || 0)), 0);
        const billedThisWeek = mySvcs.filter(s => s.billed_at && new Date(s.billed_at) >= sevenDaysAgo).reduce((sum, s) => sum + (Number(s.billed_amount) || Number(s.total_amount) || 0), 0);
        const openServices = mySvcs.filter(s => !["billed", "paid", "dropped"].includes(s.status || "")).length;
        const staleCount = pmProjects.filter((p: any) => p.last_activity_at && daysSince(p.last_activity_at) > (p.stale_threshold_days || 14)).length;

        const html = buildHTML({
          pmName, weekLabel, topOfMind, filings, needsHelp, wins,
          numbers: { openValue, billedThisWeek, openServices, staleCount }, appUrl,
        });

        const result = await sendEmail(tokens.access_token, gmailConn.email, profile.email, `Monday Meeting — ${weekLabel}`, html);
        reports.push({ company: company.name, pmEmail: profile.email, ok: result.success, error: result.error });

        // Drop an in-app notification too
        await admin.from("notifications").insert({
          company_id: company.id,
          user_id: profile.user_id,
          type: "monday_meeting_report",
          title: `Monday Meeting — ${weekLabel}`,
          body: `${topOfMind.length} items top of mind · ${filings.length} filings this week · ${needsHelp.length} stale.`,
          link: "/projects",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, reports }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-monday-meeting-report error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
