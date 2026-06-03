import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { expense_id, approver_profile_ids } = await req.json();
    if (!expense_id) {
      return new Response(JSON.stringify({ error: "expense_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load expense + project
    const { data: exp, error: expErr } = await supabase
      .from("project_expenses")
      .select("*, projects(id, name, project_number, properties(address)), created_by_profile:profiles!project_expenses_created_by_fkey(display_name, first_name, last_name)")
      .eq("id", expense_id)
      .maybeSingle();
    if (expErr) throw expErr;
    if (!exp) {
      return new Response(JSON.stringify({ error: "expense not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve approver user emails
    let profileIds: string[] = Array.isArray(approver_profile_ids) ? approver_profile_ids : [];
    if (profileIds.length === 0) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", exp.company_id)
        .eq("role", "admin")
        .eq("is_active", true);
      profileIds = (admins || []).map((a: any) => a.id);
    }

    if (profileIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_approvers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: approvers } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, display_name")
      .in("id", profileIds);

    // Get auth emails for those users
    const userIds = (approvers || []).map((a: any) => a.user_id).filter(Boolean);
    const emails: { email: string; name: string }[] = [];
    for (const uid of userIds) {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      const ap = (approvers || []).find((a: any) => a.user_id === uid);
      if (u?.user?.email && ap) {
        emails.push({
          email: u.user.email,
          name: ap.display_name || `${ap.first_name || ""} ${ap.last_name || ""}`.trim() || "Approver",
        });
      }
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const project = (exp as any).projects || {};
    const projRef = `${project.project_number || ""} ${project.name || ""}`.trim() || "Project";
    const address = project.properties?.address || "";
    const requester = (exp as any).created_by_profile;
    const requesterName = requester?.display_name || `${requester?.first_name || ""} ${requester?.last_name || ""}`.trim() || "PM";
    const amount = `$${Number(exp.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const billable = `$${Number(exp.billable_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const link = `https://ordinov3.lovable.app/dashboard?expense=${exp.id}`;
    const subject = `Expense Approval — ${amount} — ${projRef}`;

    const accent = "#f59e0b";

    const htmlBody = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:20px 24px;background:${accent};color:#fff;">
            <div style="font-size:13px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.9;">Expense Approval Needed</div>
            <div style="font-size:22px;font-weight:700;margin-top:4px;">${amount}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 16px;font-size:14px;color:#1a1a1a;">
              <strong>${requesterName}</strong> is requesting approval to pay an expense.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
              <tr><td style="padding:10px 14px;font-size:13px;color:#666;width:130px;">Project</td><td style="padding:10px 14px;font-size:13px;color:#111;">${projRef}</td></tr>
              ${address ? `<tr><td style="padding:10px 14px;font-size:13px;color:#666;">Address</td><td style="padding:10px 14px;font-size:13px;color:#111;">${address}</td></tr>` : ""}
              <tr><td style="padding:10px 14px;font-size:13px;color:#666;">Description</td><td style="padding:10px 14px;font-size:13px;color:#111;">${exp.description}</td></tr>
              ${exp.vendor ? `<tr><td style="padding:10px 14px;font-size:13px;color:#666;">Vendor</td><td style="padding:10px 14px;font-size:13px;color:#111;">${exp.vendor}</td></tr>` : ""}
              <tr><td style="padding:10px 14px;font-size:13px;color:#666;">Cost</td><td style="padding:10px 14px;font-size:13px;color:#111;font-weight:600;">${amount}</td></tr>
              ${Number(exp.markup_pct) > 0 ? `<tr><td style="padding:10px 14px;font-size:13px;color:#666;">Markup</td><td style="padding:10px 14px;font-size:13px;color:#111;">${exp.markup_pct}% (bills to client: ${billable})</td></tr>` : ""}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${link}" style="display:inline-block;padding:12px 28px;background:${accent};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review & Approve</a>
            </div>
          </td>
        </tr>
        <tr><td style="padding:14px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;text-align:center;">Ordino · Expense Approvals</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

    const sentTo: string[] = [];
    for (const r of emails) {
      try {
        await supabase.functions.invoke("gmail-send", {
          body: { to: r.email, subject, html_body: htmlBody },
        });
        sentTo.push(r.email);
      } catch (err) {
        console.error("gmail-send failed for", r.email, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent_to: sentTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
