// Daily cron: emits 'invoice_overdue' notifications for every invoice past due_date
// that is not paid/void and doesn't already have an invoice_overdue notification.
// Uses absolute condition (due_date < now() AND status NOT IN ('paid','void'))
// so the run is idempotent and tolerant of skipped days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const isCron = expected && cronSecret === expected;
  const isService =
    authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, company_id, project_id, invoice_number, total_due, due_date, status")
      .lt("due_date", todayStr)
      .not("status", "in", "(paid,void)");
    if (error) throw error;

    // Pull accounting users grouped by company
    const { data: acctRoles } = await supabase
      .from("user_roles")
      .select("user_id, company_id")
      .eq("role", "accounting");
    const acctByCompany = new Map<string, string[]>();
    for (const r of acctRoles || []) {
      if (!r.company_id || !r.user_id) continue;
      const arr = acctByCompany.get(r.company_id) || [];
      arr.push(r.user_id);
      acctByCompany.set(r.company_id, arr);
    }
    // Map auth user_id -> profile.id (notifications.user_id references profiles.id)
    const allAuthIds = Array.from(new Set((acctRoles || []).map((r) => r.user_id).filter(Boolean) as string[]));
    const { data: acctProfiles } = allAuthIds.length
      ? await supabase.from("profiles").select("id, user_id, company_id").in("user_id", allAuthIds)
      : { data: [] as Array<{ id: string; user_id: string; company_id: string }> };
    const profileByAuthCompany = new Map<string, string>(); // key: `${user_id}|${company_id}` -> profile.id
    for (const p of acctProfiles || []) {
      profileByAuthCompany.set(`${p.user_id}|${p.company_id}`, p.id);
    }

    let created = 0;
    let skipped = 0;

    for (const inv of invoices || []) {
      // Existence check: any prior invoice_overdue notif linking this invoice?
      const link = `/invoices/${inv.id}`;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("type", "invoice_overdue")
        .eq("link", link);
      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }

      // PM
      let pmProfileId: string | null = null;
      let projName: string | null = null;
      if (inv.project_id) {
        const { data: proj } = await supabase
          .from("projects")
          .select("assigned_pm_id, name")
          .eq("id", inv.project_id)
          .maybeSingle();
        pmProfileId = proj?.assigned_pm_id ?? null;
        projName = proj?.name ?? null;
      }

      const recipients = new Set<string>();
      if (pmProfileId) recipients.add(pmProfileId);
      for (const authUid of acctByCompany.get(inv.company_id) || []) {
        const pid = profileByAuthCompany.get(`${authUid}|${inv.company_id}`);
        if (pid) recipients.add(pid);
      }
      if (recipients.size === 0) {
        skipped++;
        continue;
      }

      const label = inv.invoice_number || "Invoice";
      const amount = Number(inv.total_due || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      const rows = Array.from(recipients).map((uid) => ({
        company_id: inv.company_id,
        user_id: uid,
        type: "invoice_overdue",
        title: `Overdue: ${label}`,
        body: `${amount} past due ${inv.due_date}${projName ? ` — ${projName}` : ""}.`,
        link,
        project_id: inv.project_id,
      }));

      const { error: insErr } = await supabase.from("notifications").insert(rows);
      if (insErr) {
        console.error("insert error", inv.id, insErr.message);
      } else {
        created += rows.length;
      }
    }

    return new Response(
      JSON.stringify({
        processed: invoices?.length ?? 0,
        notifications_created: created,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-overdue-invoices error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
