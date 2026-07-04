import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, CalendarClock } from "lucide-react";
import { useBdSourcedSummary, useMyOpenFollowUps } from "@/hooks/useBdComp";

/** Tiny add-on for PMDailyView morning briefing. */
export function BdBriefingCard() {
  const followUps = useMyOpenFollowUps();
  const bd = useBdSourcedSummary(30);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" /> BD pulse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link to="/bd/leads?view=followups" className="flex items-center justify-between group">
          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Open follow-ups
          </div>
          <span className="text-xl font-semibold group-hover:text-amber-600">{followUps.data?.length ?? 0}</span>
        </Link>
        <Link to="/reports?tab=bd" className="flex items-center justify-between group">
          <div className="text-sm">BD-sourced this period</div>
          <span className="text-xl font-semibold group-hover:text-amber-600">{bd.data?.count ?? 0}</span>
        </Link>
      </CardContent>
    </Card>
  );
}

export default BdBriefingCard;
