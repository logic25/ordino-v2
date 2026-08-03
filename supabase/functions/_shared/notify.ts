// Shared: create in-app notifications for GLE staff on Beacon ingest events.
//
// Semantics that make the bell actually light up (verified against existing inserters
// like check-completion-reminders and the action-item trigger):
//   • notifications.user_id references profiles.id (NOT auth.users.id).
//   • Required columns: company_id, user_id, type, title. Optional: body, link.
//
// Recipients are resolved from BEACON_NOTIFY_EMAILS (comma-separated auth emails),
// defaulting to Manny + Chris. Emails → auth.users (admin API) → profiles.id.
//
// notifyStaff never throws: a notification failure must not break the ingest that
// triggered it.

const DEFAULT_NOTIFY_EMAILS =
  "manny@greenlightexpediting.com,chris@greenlightexpediting.com";

export type IngestNotification = {
  type: string; // e.g. "beacon_bd_signal" | "beacon_content" | "beacon_kb"
  title: string;
  body?: string | null;
  link?: string | null;
};

// Resolve recipients to { profileId, companyId }. Cheap for a tiny firm; edge
// functions are short-lived so we resolve per-invocation rather than cache.
async function resolveRecipients(
  sb: any,
): Promise<Array<{ profileId: string; companyId: string }>> {
  const emails = (Deno.env.get("BEACON_NOTIFY_EMAILS") ?? DEFAULT_NOTIFY_EMAILS)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return [];

  // auth.users email → auth id (service-role admin API). GLE is tiny → one page.
  const { data: usersPage, error } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !usersPage?.users) {
    console.error("notifyStaff: listUsers failed:", error?.message);
    return [];
  }
  const authIds = usersPage.users
    .filter((u: any) => u.email && emails.includes(u.email.toLowerCase()))
    .map((u: any) => u.id);
  if (authIds.length === 0) return [];

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, company_id")
    .in("user_id", authIds);
  return (profiles ?? []).map((p: any) => ({
    profileId: p.id,
    companyId: p.company_id,
  }));
}

export async function notifyStaff(
  sb: any,
  n: IngestNotification,
): Promise<void> {
  try {
    const recipients = await resolveRecipients(sb);
    if (recipients.length === 0) return;
    const rows = recipients.map((r) => ({
      company_id: r.companyId,
      user_id: r.profileId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    }));
    const { error } = await sb.from("notifications").insert(rows);
    if (error) console.error("notifyStaff: insert error:", error.message);
  } catch (e: any) {
    console.error("notifyStaff: failed:", e?.message ?? e);
  }
}
