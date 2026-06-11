// weekly-project-digest: runs Mondays via pg_cron.
// Buckets every open project into Active (≤7d signal) / Quiet (8–30d) / Stale (>30d).
//   - Active: reuse last AI summary if <24h fresh, else regenerate via summarize-project.
//   - Quiet:  reuse last summary, no AI call. Flagged.
//   - Stale:  regenerate so PM sees fresh read before action. Flagged.
// Per-PM cap of 25 AI regenerations per run; remainder reuse last summary.
// Sends per-PM email via send-transactional-email (if configured) + in-app notification.
// Admins get a company-wide roll-up. Logs aggregate counts to automation_logs.
// Auth: x-cron-secret header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const PER_PM_AI_CAP = 25;

type Bucket = "active" | "quiet" | "stale";

interface DigestItem {
  projectId: string;
  name: string;
  number: string | null;
  bucket: Bucket;
  daysSinceMovement: number;
  summary: string;
  pmProfileId: string | null;
  companyId: string;
  aiRegenerated: boolean;
  skippedReason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve cron secret (env or vault)
    let cronSecret = Deno.env.get("CRON_SECRET") || "";
    if (!cronSecret) {
      const { data: vaultRow } = await admin
        .schema("vault" as any)
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("name", "cron_secret")
        .maybeSingle();
      cronSecret = (vaultRow as any)?.decrypted_secret || "";
    }
    const callerSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || callerSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const isoNow = new Date(now).toISOString();
    const isoThirtyAgo = new Date(now - THIRTY_DAYS_MS).toISOString();

    // Pull eligible projects (open, assigned to a PM, not archived/on_hold)
    const { data: projects, error } = await admin
      .from("projects")
      .select("id, company_id, assigned_pm_id, senior_pm_id, name, project_number, updated_at")
      .eq("status", "open")
      .not("assigned_pm_id", "is", null);

    if (error) throw error;

    const projectIds = (projects || []).map((p) => p.id);
    if (projectIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No eligible projects" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- Gather last-signal timestamps per project (one pass per source) --------
    const lastSignal = new Map<string, number>(); // project_id -> epoch ms of most recent signal

    const mergeSignal = (pid: string, ts: string | null | undefined) => {
      if (!ts) return;
      const t = new Date(ts).getTime();
      if (!Number.isFinite(t)) return;
      const cur = lastSignal.get(pid) ?? 0;
      if (t > cur) lastSignal.set(pid, t);
    };

    // project_notes
    const { data: notes } = await admin
      .from("project_notes")
      .select("project_id, created_at")
      .in("project_id", projectIds)
      .gte("created_at", isoThirtyAgo)
      .order("created_at", { ascending: false });
    notes?.forEach((n: any) => mergeSignal(n.project_id, n.created_at));

    // project_timeline_events
    const { data: events } = await admin
      .from("project_timeline_events")
      .select("project_id, created_at")
      .in("project_id", projectIds)
      .gte("created_at", isoThirtyAgo);
    events?.forEach((e: any) => mergeSignal(e.project_id, e.created_at));

    // services (updated_at)
    const { data: svcs } = await admin
      .from("services")
      .select("project_id, updated_at")
      .in("project_id", projectIds)
      .gte("updated_at", isoThirtyAgo);
    svcs?.forEach((s: any) => mergeSignal(s.project_id, s.updated_at));

    // For projects with no signal in 30 days, use project.updated_at to compute days since
    for (const p of projects!) {
      if (!lastSignal.has(p.id) && p.updated_at) {
        lastSignal.set(p.id, new Date(p.updated_at).getTime());
      }
    }

    // -------- Latest existing AI summary per project (for reuse) --------
    const { data: existingSummaries } = await admin
      .from("project_notes")
      .select("project_id, body, created_at, source")
      .in("project_id", projectIds)
      .in("source", ["ai_weekly", "ai_on_demand"])
      .order("created_at", { ascending: false });

    const latestSummary = new Map<string, { body: string; created_at: string }>();
    existingSummaries?.forEach((n: any) => {
      if (!latestSummary.has(n.project_id)) {
        latestSummary.set(n.project_id, { body: n.body, created_at: n.created_at });
      }
    });

    // -------- Bucket projects + count AI regens per PM (cap enforcement) --------
    const items: DigestItem[] = [];
    const aiCountByPm = new Map<string, number>();

    for (const p of projects!) {
      const ts = lastSignal.get(p.id) ?? 0;
      const age = ts > 0 ? now - ts : Number.POSITIVE_INFINITY;
      const days = ts > 0 ? Math.floor(age / (24 * 60 * 60 * 1000)) : 999;

      let bucket: Bucket;
      if (age <= SEVEN_DAYS_MS) bucket = "active";
      else if (age <= THIRTY_DAYS_MS) bucket = "quiet";
      else bucket = "stale";

      const pmProfileId = (p.assigned_pm_id || p.senior_pm_id) as string | null;
      const last = latestSummary.get(p.id);
      const lastIsFresh = last && (now - new Date(last.created_at).getTime() < TWENTY_FOUR_HOURS_MS);

      // Decide regen
      let shouldRegen = false;
      if (bucket === "active" && !lastIsFresh) shouldRegen = true;
      if (bucket === "stale") shouldRegen = true;

      // Enforce per-PM cap
      let skippedReason: string | undefined;
      if (shouldRegen && pmProfileId) {
        const c = aiCountByPm.get(pmProfileId) ?? 0;
        if (c >= PER_PM_AI_CAP) {
          shouldRegen = false;
          skippedReason = "Skipped — capacity";
        } else {
          aiCountByPm.set(pmProfileId, c + 1);
        }
      }

      items.push({
        projectId: p.id,
        name: p.name || "Untitled",
        number: p.project_number,
        bucket,
        daysSinceMovement: days,
        summary: last?.body || "_No AI summary yet._",
        pmProfileId,
        companyId: p.company_id,
        aiRegenerated: false, // set below if regen succeeds
        skippedReason,
      });

      // (regen happens in next loop so we can pace + handle errors)
      (items[items.length - 1] as any)._shouldRegen = shouldRegen;
    }

    // -------- Run AI regenerations sequentially (rate-limit friendly) --------
    let aiCallsMade = 0;
    let aiCallsFailed = 0;

    for (const it of items) {
      if (!(it as any)._shouldRegen) continue;
      try {
        let actorUserId: string | null = null;
        if (it.pmProfileId) {
          const { data: prof } = await admin.from("profiles").select("user_id").eq("id", it.pmProfileId).maybeSingle();
          actorUserId = prof?.user_id ?? null;
        }
        const res = await fetch(`${supabaseUrl}/functions/v1/summarize-project`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
          body: JSON.stringify({
            projectId: it.projectId,
            persist: true,
            source: "ai_weekly",
            companyId: it.companyId,
            actorUserId,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        it.summary = j.summary || it.summary;
        it.aiRegenerated = true;
        aiCallsMade++;
      } catch (err: any) {
        console.error("weekly-project-digest regen failed", it.projectId, err);
        aiCallsFailed++;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    // -------- Group by PM and send digest --------
    const byPm = new Map<string, { companyId: string; items: DigestItem[] }>();
    for (const it of items) {
      if (!it.pmProfileId) continue;
      const key = `${it.pmProfileId}:${it.companyId}`;
      if (!byPm.has(key)) byPm.set(key, { companyId: it.companyId, items: [] });
      byPm.get(key)!.items.push(it);
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    let inAppSent = 0;

    const weekKey = `${new Date(now).getUTCFullYear()}-W${Math.ceil(((new Date(now).getTime() - Date.UTC(new Date(now).getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;

    for (const [key, { companyId, items: pmItems }] of byPm.entries()) {
      const pmProfileId = key.split(":")[0];
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id, full_name, notification_preferences")
        .eq("id", pmProfileId)
        .maybeSingle();
      if (!prof?.user_id) continue;

      const pref = (prof.notification_preferences as any)?.weekly_project_digest;
      const enabled = pref?.enabled !== false; // default on
      const scope = pref?.scope || "active_stale"; // all | active_only | active_stale

      let visible = pmItems;
      if (scope === "active_only") visible = pmItems.filter((i) => i.bucket === "active");
      else if (scope === "active_stale") visible = pmItems.filter((i) => i.bucket !== "quiet");

      const counts = {
        active: pmItems.filter((i) => i.bucket === "active").length,
        quiet: pmItems.filter((i) => i.bucket === "quiet").length,
        stale: pmItems.filter((i) => i.bucket === "stale").length,
      };

      // In-app notification (always)
      const bodyLines = [
        `Active ${counts.active} · Quiet ${counts.quiet} · Stale ${counts.stale}`,
        "",
        ...visible.slice(0, 25).flatMap((it) => {
          const tag = it.bucket === "stale" ? "🔴 STALE" : it.bucket === "quiet" ? "🟡 Quiet" : "🟢";
          return [`${tag} ${it.name}${it.number ? ` (#${it.number})` : ""} — ${it.daysSinceMovement}d`, it.summary, ""];
        }),
      ];
      const { error: notifErr } = await admin.from("notifications").insert({
        company_id: companyId,
        user_id: prof.user_id,
        type: "weekly_project_digest",
        title: `Weekly digest — ${counts.active} active · ${counts.quiet} quiet · ${counts.stale} stale`,
        body: bodyLines.join("\n").trim(),
        link: "/projects",
      });
      if (!notifErr) inAppSent++;

      // Email (if enabled + email infra wired)
      if (!enabled) continue;
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(prof.user_id);
        const recipientEmail = authUser?.user?.email;
        if (!recipientEmail) continue;

        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            templateName: "weekly-project-digest",
            recipientEmail,
            idempotencyKey: `weekly-digest-${prof.user_id}-${weekKey}`,
            templateData: {
              name: (prof as any).full_name || "there",
              counts,
              items: visible.slice(0, 50).map((it) => ({
                name: it.name,
                number: it.number,
                bucket: it.bucket,
                daysSinceMovement: it.daysSinceMovement,
                summary: it.summary,
                projectId: it.projectId,
              })),
              appUrl: Deno.env.get("APP_URL") || "https://ordinopm.com",
            },
          }),
        });
        if (emailRes.ok) emailsSent++;
        else {
          emailsFailed++;
          const t = await emailRes.text();
          console.warn("weekly-digest email send failed", emailRes.status, t);
        }
      } catch (e: any) {
        emailsFailed++;
        console.warn("weekly-digest email error", e?.message || e);
      }
    }

    // -------- Automation log --------
    await admin.from("automation_logs").insert({
      company_id: null,
      action_taken: "weekly_project_digest",
      result: "ok",
      metadata: {
        projects_evaluated: items.length,
        active: items.filter((i) => i.bucket === "active").length,
        quiet: items.filter((i) => i.bucket === "quiet").length,
        stale: items.filter((i) => i.bucket === "stale").length,
        ai_calls_made: aiCallsMade,
        ai_calls_failed: aiCallsFailed,
        ai_calls_skipped_capacity: items.filter((i) => i.skippedReason === "Skipped — capacity").length,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        in_app_sent: inAppSent,
        recipients: byPm.size,
        ran_at: isoNow,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      projects_evaluated: items.length,
      ai_calls_made: aiCallsMade,
      ai_calls_failed: aiCallsFailed,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      in_app_sent: inAppSent,
      recipients: byPm.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("weekly-project-digest error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
