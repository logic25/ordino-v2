import { Badge } from "@/components/ui/badge";
import { Circle, Mail, Pencil, FileText, ClipboardList, CheckCircle2, GitBranch, PenLine, Send, CheckCheck, ShieldCheck, XCircle } from "lucide-react";
import { useTimelineEvents } from "@/hooks/useTimelineEvents";
import { format } from "date-fns";
import type { MockMilestone } from "@/components/projects/projectMockData";

export function TimelineFull({ milestones, projectId }: { milestones: MockMilestone[]; projectId?: string }) {
  const { data: dbEvents = [] } = useTimelineEvents(projectId);
  const sourceIcons: Record<string, typeof Circle> = { system: Circle, email: Mail, user: Pencil, dob: FileText };
  const eventIcons: Record<string, typeof Circle> = {
    action_item_created: ClipboardList,
    action_item_completed: CheckCircle2,
    co_created: GitBranch,
    co_signed_internally: PenLine,
    co_sent_to_client: Send,
    co_client_signed: CheckCheck,
    co_approved: ShieldCheck,
    co_voided: XCircle,
    co_rejected: XCircle,
  };

  type TimelineItem = { id: string; date: string; event: string; source: string; details?: string; _sortTime: number; _eventType?: string };

  const dbAsMilestones: TimelineItem[] = dbEvents.map(ev => ({
    id: ev.id,
    date: format(new Date(ev.created_at), "MM/dd/yyyy"),
    event: ev.description || ev.event_type.replace(/_/g, " "),
    source: "system",
    _sortTime: new Date(ev.created_at).getTime(),
    _eventType: ev.event_type,
  }));

  const manualWithTime: TimelineItem[] = milestones.map(m => ({
    id: m.id,
    date: m.date,
    event: m.event,
    source: m.source,
    details: m.details,
    _sortTime: new Date(m.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2")).getTime(),
    _eventType: undefined,
  }));

  const combined = [...manualWithTime, ...dbAsMilestones].sort((a, b) => a._sortTime - b._sortTime);

  if (combined.length === 0) {
    return <p className="text-sm text-muted-foreground italic p-6">No timeline events yet.</p>;
  }

  return (
    <div className="p-6 space-y-0">
      {combined.map((m, i) => {
        const Icon = m._eventType ? (eventIcons[m._eventType] || Circle) : (sourceIcons[m.source] || Circle);
        return (
          <div key={m.id} className="flex gap-4 relative">
            {i < combined.length - 1 && <div className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />}
            <div className="shrink-0 mt-1 z-10 bg-background rounded-full">
              <Icon className="h-[26px] w-[26px] p-1.5 rounded-full bg-muted text-muted-foreground" />
            </div>
            <div className="pb-5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{m.date}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                  {m._eventType ? m._eventType.replace(/_/g, " ") : m.source}
                </Badge>
              </div>
              <p className="text-sm mt-1">{m.event}</p>
              {(m as any).details && <p className="text-xs text-muted-foreground mt-0.5">{(m as any).details}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
