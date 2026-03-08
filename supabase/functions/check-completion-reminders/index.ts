import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Service-role auth check for scheduled/internal calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Calculate threshold dates
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    const twoWeeksStr = twoWeeksFromNow.toISOString().split("T")[0];

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

    // Fetch all open projects with a completion_date set
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, company_id, name, project_number, completion_date, assigned_pm_id, senior_pm_id, completion_reminder_2w_sent, completion_reminder_due_sent, completion_reminder_overdue_sent")
      .eq("status", "open")
      .not("completion_date", "is", null);

    if (error) throw error;

    const notifications: Array<{
      company_id: string;
      user_id: string;
      type: string;
      title: string;
      body: string;
      link: string;
      metadata: Record<string, unknown>;
    }> = [];

    const updates: Array<{ id: string; fields: Record<string, boolean> }> = [];

    for (const project of projects || []) {
      const completionDate = project.completion_date;
      const label = project.project_number || project.name || "Untitled";
      const recipients = [project.assigned_pm_id, project.senior_pm_id].filter(Boolean) as string[];
      if (recipients.length === 0) continue;

      // 2 weeks before (completion_date <= twoWeeksFromNow AND > today)
      if (!project.completion_reminder_2w_sent && completionDate <= twoWeeksStr && completionDate > todayStr) {
        for (const userId of recipients) {
          notifications.push({
            company_id: project.company_id,
            user_id: userId,
            type: "completion_approaching",
            title: "Project Completion Approaching",
            body: `${label} is due in ~2 weeks (${completionDate}). Review status and plan for closeout.`,
            link: `/projects/${project.id}`,
            metadata: { project_id: project.id, reminder: "2_weeks_before" },
          });
        }
        updates.push({ id: project.id, fields: { completion_reminder_2w_sent: true } });
      }

      // On the date
      if (!project.completion_reminder_due_sent && completionDate <= todayStr) {
        for (const userId of recipients) {
          notifications.push({
            company_id: project.company_id,
            user_id: userId,
            type: "completion_due",
            title: "Project Completion Date Reached",
            body: `${label} expected completion is today (${completionDate}). Is this project ready to close?`,
            link: `/projects/${project.id}`,
            metadata: { project_id: project.id, reminder: "on_date" },
          });
        }
        updates.push({ id: project.id, fields: { completion_reminder_due_sent: true } });
      }

      // 1 week overdue
      if (!project.completion_reminder_overdue_sent && completionDate <= oneWeekAgoStr) {
        for (const userId of recipients) {
          notifications.push({
            company_id: project.company_id,
            user_id: userId,
            type: "completion_overdue",
            title: "Project Overdue",
            body: `${label} is 1+ week past its expected completion (${completionDate}). Please update status or extend the date.`,
            link: `/projects/${project.id}`,
            metadata: { project_id: project.id, reminder: "1_week_overdue" },
          });
        }
        updates.push({ id: project.id, fields: { completion_reminder_overdue_sent: true } });
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (notifError) console.error("Notification insert error:", notifError);
    }

    // Update reminder flags
    for (const upd of updates) {
      await supabase
        .from("projects")
        .update(upd.fields)
        .eq("id", upd.id);
    }

    return new Response(
      JSON.stringify({
        processed: (projects || []).length,
        notifications_created: notifications.length,
        projects_updated: updates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
