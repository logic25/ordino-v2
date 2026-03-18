import { Badge } from "@/components/ui/badge";
import {
  Circle, ClipboardList, CheckCircle2, GitBranch, CircleDot,
  Send, CheckCheck, XCircle,
} from "lucide-react";
import { useTimelineEvents } from "@/hooks/useTimelineEvents";

const eventIcons: Record<string, typeof Circle> = {
  action_item_created: ClipboardList,
  action_item_completed: CheckCircle2,
  co_created: GitBranch,
  co_signed_internally: CircleDot,
  co_sent_to_client: Send,
  co_client_signed: CheckCheck,
  co_approved: CheckCircle2,
  co_voided: XCircle,
  co_rejected: XCircle,
};

export function TimelineTab({ projectId }: { projectId?: string }) {
  const { data: events = [], isLoading } = useTimelineEvents(projectId);

  if (isLoading) return <p className="text-sm text-muted-foreground italic p-4">Loading timeline...</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No timeline events yet.</p>;

  return (
    <div className="p-4 space-y-0">
      {events.map((ev, i) => {
        const Icon = eventIcons[ev.event_type] || Circle;
        const actorName = ev.actor?.display_name || ev.actor?.first_name || "System";
        const date = new Date(ev.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
        const time = new Date(ev.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return (
          <div key={ev.id} className="flex gap-3 relative">
            {i < events.length - 1 && <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />}
            <div className="shrink-0 mt-1 z-10 bg-background rounded-full">
              <Icon className="h-[22px] w-[22px] p-1 rounded-full bg-muted text-muted-foreground" />
            </div>
            <div className="pb-4 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{date} {time}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{ev.event_type.replace(/_/g, " ")}</Badge>
              </div>
              <p className="text-sm mt-0.5">{ev.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
