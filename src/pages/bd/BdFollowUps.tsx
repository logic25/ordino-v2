import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useFollowUps, useSetFollowUp, type FollowUpLead } from "@/hooks/useFollowUps";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CalendarClock } from "lucide-react";
import { format, addDays, isBefore, isToday, parseISO, startOfDay } from "date-fns";

function bucketOf(dateStr: string): "overdue" | "today" | "week" | "later" {
  const d = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  if (isToday(d)) return "today";
  if (isBefore(d, today)) return "overdue";
  if (isBefore(d, addDays(today, 8))) return "week";
  return "later";
}

const SECTIONS: { key: "overdue" | "today" | "week" | "later"; label: string; tone: string }[] = [
  { key: "overdue", label: "Overdue", tone: "text-red-600" },
  { key: "today", label: "Due today", tone: "text-amber-600" },
  { key: "week", label: "This week", tone: "text-foreground" },
  { key: "later", label: "Later", tone: "text-muted-foreground" },
];

export default function BdFollowUps() {
  const { data = [], isLoading } = useFollowUps();
  const setFollowUp = useSetFollowUp();

  const grouped = useMemo(() => {
    const g: Record<string, FollowUpLead[]> = { overdue: [], today: [], week: [], later: [] };
    for (const lead of data) g[bucketOf(lead.next_follow_up_at)].push(lead);
    return g;
  }, [data]);

  const reschedule = (lead: FollowUpLead, days: number | null) => {
    const next = days === null ? null : format(addDays(new Date(), days), "yyyy-MM-dd");
    setFollowUp.mutate({ leadId: lead.id, next_follow_up_at: next, logTouch: true });
  };

  const total = data.length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="h-6 w-6" /> Follow-ups
        </h1>
        <p className="text-sm text-muted-foreground">
          People you owe a personal touch. Reach out, then log it and set the next nudge.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : total === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No follow-ups scheduled. Set a "next follow-up" on a lead and it shows up here.
        </Card>
      ) : (
        SECTIONS.map((s) =>
          grouped[s.key].length === 0 ? null : (
            <div key={s.key} className="space-y-2">
              <div className={`text-xs font-semibold uppercase tracking-wide ${s.tone}`}>
                {s.label} ({grouped[s.key].length})
              </div>
              {grouped[s.key].map((lead) => (
                <Card key={lead.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/bd/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.full_name}
                    </Link>
                    {lead.company && <span className="text-muted-foreground"> · {lead.company}</span>}
                    {lead.stage && <Badge variant="outline" className="ml-2 text-[10px]">{lead.stage}</Badge>}
                    {lead.follow_up_note && (
                      <div className="text-sm text-muted-foreground mt-0.5">{lead.follow_up_note}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Due {format(parseISO(lead.next_follow_up_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0 justify-end">
                    <span className="text-[10px] text-muted-foreground mr-1">Did it →</span>
                    <Button size="sm" variant="outline" onClick={() => reschedule(lead, 30)}>+1mo</Button>
                    <Button size="sm" variant="outline" onClick={() => reschedule(lead, 60)}>+2mo</Button>
                    <Button size="sm" variant="outline" onClick={() => reschedule(lead, 90)}>+3mo</Button>
                    <Button size="sm" variant="ghost" title="Done — clear" onClick={() => reschedule(lead, null)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        )
      )}
    </div>
  );
}
