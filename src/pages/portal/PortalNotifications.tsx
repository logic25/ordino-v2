import { Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalNotifications, useMarkNotificationRead } from "@/hooks/usePortal";
import { Bell, CheckCheck } from "lucide-react";
import { safeFormatDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  filing_blocked: "Filing blocked",
  filing_objections: "Objections received",
  filing_approved: "Filing approved",
  filing_permit_issued: "Permit issued",
  client_action_required: "Action required",
};

export default function PortalNotifications() {
  const { data: notifs = [], isLoading } = usePortalNotifications();
  const mark = useMarkNotificationRead();

  return (
    <PortalLayout>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Notifications</h1>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16 rounded-lg border bg-white text-muted-foreground text-sm">
          <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
          You're all caught up.
        </div>
      ) : (
        <div className="rounded-lg border bg-white divide-y">
          {notifs.map((n) => (
            <div key={n.id} className={cn("p-4 flex items-start gap-4", !n.read && "bg-amber-50/40")}>
              <div className={cn("h-2 w-2 rounded-full mt-2 shrink-0", n.read ? "bg-slate-200" : "bg-amber-500")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{TYPE_LABEL[n.type] ?? n.type}</span>
                  <span>·</span>
                  <span>{safeFormatDate(n.created_at, "MMM d, HH:mm")}</span>
                </div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">{n.title}</div>
                {n.message && <div className="mt-0.5 text-sm text-slate-700">{n.message}</div>}
                {n.project_id && (
                  <Link to={`/portal/projects/${n.project_id}`} className="mt-2 inline-block text-xs text-sky-700 hover:underline">
                    View project →
                  </Link>
                )}
              </div>
              {!n.read && (
                <button
                  onClick={() => mark.mutate(n.id)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
