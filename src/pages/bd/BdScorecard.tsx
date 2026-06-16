import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Clock, Target, TrendingUp, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useIsCompAdmin, useBdScorecard } from "@/hooks/useBdComp";
import { money } from "@/lib/bdComp";

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function BdScorecard() {
  const { profile } = useAuth();
  const isCompAdmin = useIsCompAdmin();
  const { data: people = [] } = useCompanyProfiles();
  const [personId, setPersonId] = useState<string | undefined>(profile?.id);
  const effectivePerson = isCompAdmin ? personId : profile?.id;
  const { data, isLoading } = useBdScorecard(effectivePerson, 90);

  const personOptions = useMemo(
    () => (isCompAdmin ? people : people.filter((p) => p.id === profile?.id)),
    [isCompAdmin, people, profile?.id]
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-7 w-7 text-amber-500" />
            <div>
              <h1 className="text-2xl font-bold">BD Scorecard</h1>
              <p className="text-sm text-muted-foreground">Last 90 days</p>
            </div>
          </div>
          <div className="w-64">
            <Select value={effectivePerson} onValueChange={setPersonId} disabled={!isCompAdmin}>
              <SelectTrigger><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>
                {personOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Metric icon={<Users className="h-3.5 w-3.5" />} label="Events attended" value={String(data.eventsAttended)} />
              <Metric icon={<Target className="h-3.5 w-3.5" />} label="Contacts captured" value={String(data.contactsCaptured)} />
              <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Avg speed to 1st touch" value={data.avgSpeedToTouchHrs == null ? "—" : `${data.avgSpeedToTouchHrs.toFixed(1)}h`} />
              <Metric icon={<DollarSign className="h-3.5 w-3.5" />} label="Pipeline value" value={money(data.pipelineValue)} />
              <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Qualify rate" value={`${Math.round(data.qualifyRate * 100)}%`} sub={`${data.qualified} of ${data.contactsCaptured}`} />
              <Metric icon={<Trophy className="h-3.5 w-3.5" />} label="Win rate" value={`${Math.round(data.winRate * 100)}%`} sub={`${data.won} won`} />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Leads by stage</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.byStage).length === 0 && (
                    <p className="text-sm text-muted-foreground">No leads in window.</p>
                  )}
                  {Object.entries(data.byStage).map(([stage, n]) => (
                    <Badge key={stage} variant="outline" className="text-sm">
                      {stage} · {n}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Funnel</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 text-center">
                  <div>
                    <div className="text-2xl font-semibold">{data.scans}</div>
                    <div className="text-xs text-muted-foreground">Scans / leads</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{data.qualified}</div>
                    <div className="text-xs text-muted-foreground">Qualified</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{data.won}</div>
                    <div className="text-xs text-muted-foreground">Won</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
