import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STATUS_CLS: Record<string, string> = {
  APPROVED: "bg-blue-100 text-blue-700 border-blue-200",
  REGISTERED: "bg-purple-100 text-purple-700 border-purple-200",
};

export function UpcomingEventsCard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: events = [] } = useQuery({
    queryKey: ["dashboard-upcoming-events"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in14 = new Date(); in14.setDate(in14.getDate() + 14);
      const end = in14.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("bd_events")
        .select("id, name, start_date, location, status")
        .in("status", ["APPROVED", "REGISTERED"])
        .gte("start_date", today)
        .lte("start_date", end)
        .order("start_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />Upcoming events (14 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events in the next 14 days.</p>
        ) : (
          events.map((e: any) => (
            <button
              key={e.id}
              onClick={() => navigate(`/bd/events/${e.id}`)}
              className="w-full text-left p-2 rounded hover:bg-muted/40 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{e.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{format(new Date(e.start_date + "T12:00:00"), "MMM d")}</span>
                  {e.location && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />{e.location}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={STATUS_CLS[e.status] ?? ""}>{e.status}</Badge>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
