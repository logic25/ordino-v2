import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerAuthId = user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve the caller's profile to find their gmail connection
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", callerAuthId)
      .single();

    const body = await req.json();
    const { action, bug_title, bug_description, bug_priority, company_id, reporter_name } = body;

    if (!company_id || !bug_title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prefer the calling user's gmail connection; fall back to first available
    const { data: connections } = await supabase
      .from("gmail_connections")
      .select("user_id, email_address, access_token, refresh_token, token_expires_at")
      .eq("company_id", company_id);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_gmail_connections" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sender = (callerProfile && connections.find(c => c.user_id === callerProfile.id)) || connections[0];

    // ── RESOLVED notification: email the reporter + all admins/managers ──
    if (action === "resolved") {
      const { reporter_user_id, admin_notes, recent_comments } = body;

      // Collect all recipients: reporter + admins/managers
      const recipients: string[] = [];

      // Helper to get email from auth via profile's user_id
      const getEmailByProfileId = async (profileId: string): Promise<string | null> => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", profileId)
          .single();
        if (!prof?.user_id) return null;
        const { data: { user } } = await supabase.auth.admin.getUserById(prof.user_id);
        return user?.email || null;
      };

      if (reporter_user_id) {
        const email = await getEmailByProfileId(reporter_user_id);
        if (email) recipients.push(email);
      }

      // Always include admins/managers
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .in("role", ["admin", "manager"]);

      for (const p of adminProfiles || []) {
        const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id);
        const email = user?.email;
        if (email && !recipients.includes(email)) {
          recipients.push(email);
        }
      }

      if (recipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const formatDesc = (desc: string | undefined) => {
        if (!desc) return "";
        return desc
          .replace(/\*\*([^*]+):\*\*/g, "<strong>$1:</strong>")
          .replace(/\\n/g, "\n")
          .split("\n")
          .filter((l: string) => l.trim())
          .map((l: string) => `<div style="color: #4b5563; font-size: 13px; line-height: 1.6;">${l.trim()}</div>`)
          .join("");
      };

      // Render recent comments thread for resolved emails
      const resolvedCommentsHtml = Array.isArray(recent_comments) && recent_comments.length > 0
        ? `<div style="margin: 20px 0;">
            <strong style="color: #374151; font-size: 14px;">💬 Recent Comments</strong>
            ${recent_comments.map((c: any) => `
              <div style="background: #f9fafb; padding: 12px 14px; border-radius: 6px; margin-top: 8px; border: 1px solid #e5e7eb;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;"><strong>${c.commenter_name || "Someone"}</strong> · ${new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                <div style="color: #374151; font-size: 14px; line-height: 1.5; white-space: pre-line;">${c.message || ""}</div>
              </div>
            `).join("")}
          </div>`
        : "";

      const resolvedHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: #16a34a; padding: 24px 32px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">✅ Bug Resolved</h2>
          </div>
          <div style="padding: 24px 32px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">The following bug has been resolved:</p>
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
              <strong style="color: #15803d; font-size: 15px;">${bug_title}</strong>
              ${bug_description ? `<div style="margin-top: 10px;">${formatDesc(bug_description)}</div>` : ""}
            </div>
            ${admin_notes ? `
              <div style="margin: 20px 0;">
                <strong style="color: #374151; font-size: 14px;">Resolution Notes</strong>
                <div style="background: #f9fafb; padding: 14px; border-radius: 6px; margin-top: 6px; white-space: pre-line; color: #4b5563; font-size: 14px; line-height: 1.5; border: 1px solid #e5e7eb;">${admin_notes}</div>
              </div>
            ` : ""}
            ${resolvedCommentsHtml}
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://ordinov3.lovable.app/help" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View in Help Center</a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">Ordino • Bug Tracker Notification</p>
          </div>
        </div>
      `;

      let sentCount = 0;
      for (const email of recipients) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              user_id: sender.user_id,
              to: email,
              subject: `✅ Bug Resolved: ${bug_title}`,
              html_body: resolvedHtml,
            }),
          });
          if (res.ok) sentCount++;
        } catch (e) {
          console.error(`Failed to send resolved email to ${email}:`, e);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REOPENED notification: email the reporter + all admins/managers ──
    if (action === "reopened" || action === "in_progress" || action === "ready_for_review") {
      const { reopened_by_name, reporter_user_id, admin_notes, recent_comments } = body;

      const recipients: string[] = [];

      const getEmailByProfileId = async (profileId: string): Promise<string | null> => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", profileId)
          .single();
        if (!prof?.user_id) return null;
        const { data: { user } } = await supabase.auth.admin.getUserById(prof.user_id);
        return user?.email || null;
      };

      // Include the reporter so they know the status changed
      if (reporter_user_id) {
        const email = await getEmailByProfileId(reporter_user_id);
        if (email) recipients.push(email);
      }

      // Always include admins/managers
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .in("role", ["admin", "manager"]);

      for (const p of adminProfiles || []) {
        const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id);
        const email = user?.email;
        if (email && !recipients.includes(email)) {
          recipients.push(email);
        }
      }

      if (recipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse structured description into readable lines
      const formatDescription = (desc: string | undefined) => {
        if (!desc) return "";
        return desc
          .replace(/\*\*([^*]+):\*\*/g, "<strong>$1:</strong>")
          .replace(/\\n/g, "\n")
          .split("\n")
          .filter((l: string) => l.trim())
          .map((l: string) => `<div style="color: #4b5563; font-size: 13px; line-height: 1.6;">${l.trim()}</div>`)
          .join("");
      };

      const isReopened = action === "reopened";
      const isReadyForReview = action === "ready_for_review";
      const headerBg = isReopened ? "#ea580c" : isReadyForReview ? "#7c3aed" : "#2563eb";
      const headerIcon = isReopened ? "🔄" : isReadyForReview ? "👀" : "🔧";
      const headerText = isReopened ? "Bug Reopened" : isReadyForReview ? "Bug Ready for Review" : "Bug In Progress";
      const cardBg = isReopened ? "#fff7ed" : isReadyForReview ? "#f5f3ff" : "#eff6ff";
      const cardBorder = isReopened ? "#ea580c" : isReadyForReview ? "#7c3aed" : "#2563eb";
      const titleColor = isReopened ? "#c2410c" : isReadyForReview ? "#6d28d9" : "#1d4ed8";
      const byLine = isReopened
        ? (reopened_by_name ? ` by <strong>${reopened_by_name}</strong>` : "")
        : "";
      const statusLabel = isReopened ? "reopened" : isReadyForReview ? "marked as ready for review" : "moved to In Progress";

      // Render recent comments thread
      const commentsHtml = Array.isArray(recent_comments) && recent_comments.length > 0
        ? `<div style="margin: 20px 0;">
            <strong style="color: #374151; font-size: 14px;">💬 Recent Comments</strong>
            ${recent_comments.map((c: any) => `
              <div style="background: #f9fafb; padding: 12px 14px; border-radius: 6px; margin-top: 8px; border: 1px solid #e5e7eb;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;"><strong>${c.commenter_name || "Someone"}</strong> · ${new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                <div style="color: #374151; font-size: 14px; line-height: 1.5; white-space: pre-line;">${c.message || ""}</div>
                ${Array.isArray(c.attachments) && c.attachments.length > 0 ? `<div style="margin-top: 6px;">${c.attachments.map((a: any) => a.type?.startsWith("image/") ? `<img src="${a.url}" alt="${a.name}" style="max-height: 80px; border-radius: 4px; margin: 2px;" />` : `<a href="${a.url}" style="color: #6366f1; font-size: 12px;">📎 ${a.name}</a>`).join(" ")}</div>` : ""}
              </div>
            `).join("")}
          </div>`
        : "";

      const statusHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: ${headerBg}; padding: 24px 32px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">${headerIcon} ${headerText}</h2>
          </div>
          <div style="padding: 24px 32px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">The following bug has been ${statusLabel}${byLine}:</p>
            <div style="background: ${cardBg}; border-left: 4px solid ${cardBorder}; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
              <strong style="color: ${titleColor}; font-size: 15px;">${bug_title}</strong>
              ${bug_description ? `<div style="margin-top: 10px;">${formatDescription(bug_description)}</div>` : ""}
            </div>
            ${isReadyForReview && admin_notes ? `
              <div style="margin: 20px 0;">
                <strong style="color: #374151; font-size: 14px;">📝 What was changed</strong>
                <div style="background: #f9fafb; padding: 14px; border-radius: 6px; margin-top: 6px; white-space: pre-line; color: #4b5563; font-size: 14px; line-height: 1.5; border: 1px solid #e5e7eb;">${admin_notes}</div>
              </div>
            ` : ""}
            ${commentsHtml}
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://ordinov3.lovable.app/help" style="display: inline-block; background: ${headerBg}; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View in Help Center</a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">Ordino • Bug Tracker Notification</p>
          </div>
        </div>
      `;

      const subjectIcon = isReopened ? "🔄" : isReadyForReview ? "👀" : "🔧";
      const subjectLabel = isReopened ? "Bug Reopened" : isReadyForReview ? "Bug Ready for Review" : "Bug In Progress";

      let sentCount = 0;
      for (const email of recipients) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              user_id: sender.user_id,
              to: email,
              subject: `${subjectIcon} ${subjectLabel}: ${bug_title}`,
              html_body: statusHtml,
            }),
          });
          if (res.ok) sentCount++;
        } catch (e) {
          console.error(`Failed to send ${action} email to ${email}:`, e);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── COMMENT notification ──
    if (action === "comment") {
      const { commenter_user_id, commenter_name, comment_message, reporter_user_id, comment_attachments } = body;

      const recipients: string[] = [];

      const getEmailByProfileId = async (profileId: string): Promise<string | null> => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", profileId)
          .single();
        if (!prof?.user_id) return null;
        const { data: { user } } = await supabase.auth.admin.getUserById(prof.user_id);
        return user?.email || null;
      };

      // Check if commenter is the reporter
      const commenterIsReporter = commenter_user_id === reporter_user_id;

      if (commenterIsReporter) {
        // Reporter commented → notify admins/managers
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("id, user_id")
          .eq("company_id", company_id)
          .eq("is_active", true)
          .in("role", ["admin", "manager"]);
        for (const p of adminProfiles || []) {
          const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id);
          if (user?.email && !recipients.includes(user.email)) recipients.push(user.email);
        }
      } else {
        // Admin/manager commented → notify reporter
        if (reporter_user_id) {
          const email = await getEmailByProfileId(reporter_user_id);
          if (email) recipients.push(email);
        }
      }

      if (recipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const commentHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: #6366f1; padding: 24px 32px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">💬 New Comment on Bug</h2>
          </div>
          <div style="padding: 24px 32px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              <strong>${commenter_name || "Someone"}</strong> commented on:
            </p>
            <div style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
              <strong style="color: #4338ca; font-size: 15px;">${bug_title}</strong>
            </div>
            <div style="background: #f9fafb; padding: 14px; border-radius: 6px; margin: 16px 0; white-space: pre-line; color: #374151; font-size: 14px; line-height: 1.5; border: 1px solid #e5e7eb;">
              ${comment_message || ""}
            </div>
            ${Array.isArray(comment_attachments) && comment_attachments.length > 0 ? `
              <div style="margin: 12px 0;">
                <strong style="color: #374151; font-size: 13px;">Attachments:</strong>
                <div style="margin-top: 8px;">
                  ${comment_attachments.map((att: any) =>
                    att.type?.startsWith("image/")
                      ? `<a href="${att.url}" target="_blank"><img src="${att.url}" alt="${att.name}" style="max-height: 120px; max-width: 200px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 4px 4px 4px 0;" /></a>`
                      : `<a href="${att.url}" target="_blank" style="color: #6366f1; font-size: 13px; text-decoration: underline;">📎 ${att.name}</a><br/>`
                  ).join("")}
                </div>
              </div>
            ` : ""}
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://ordinov3.lovable.app/help" style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Bug</a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">Ordino • Bug Tracker Notification</p>
          </div>
        </div>
      `;

      let sentCount = 0;
      for (const email of recipients) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              user_id: sender.user_id,
              to: email,
              subject: `💬 Comment on Bug: ${bug_title}`,
              html_body: commentHtml,
            }),
          });
          if (res.ok) sentCount++;
        } catch (e) {
          console.error(`Failed to send comment email to ${email}:`, e);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newBugAdminProfiles } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .in("role", ["admin", "manager"]);

    const adminEmails: string[] = [];
    for (const p of newBugAdminProfiles || []) {
      const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id);
      if (user?.email) adminEmails.push(user.email);
    }

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_admin_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priorityColor = bug_priority === "critical" ? "#dc2626" : bug_priority === "high" ? "#ea580c" : "#6b7280";

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🐛 New Bug Report</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Title</td>
            <td style="padding: 8px;">${bug_title}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Priority</td>
            <td style="padding: 8px;">
              <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                ${bug_priority?.toUpperCase() || "MEDIUM"}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Reporter</td>
            <td style="padding: 8px;">${reporter_name || "Unknown"}</td>
          </tr>
        </table>
        <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-top: 8px; white-space: pre-line;">
          ${bug_description || "No description provided."}
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">
          View and manage this bug in <a href="https://ordinov3.lovable.app/help">Ordino Help Center</a>.
        </p>
      </div>
    `;

    let sentCount = 0;
    for (const email of adminEmails) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            user_id: sender.user_id,
            to: email,
            subject: `🐛 Bug Report: ${bug_title}`,
            html_body: htmlBody,
          }),
        });
        if (res.ok) sentCount++;
      } catch (e) {
        console.error(`Failed to send bug alert to ${email}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-bug-alert error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
