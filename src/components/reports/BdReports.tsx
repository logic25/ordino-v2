import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Lead = {
  id: string;
  source: string | null;
  status: string | null;
  stage: string | null;
  expected_value: number | null;
  proposal_id: string | null;
  event_id: string | null;
  created_at: string;
};
type Event = { id: string; name: string };
type Client = { id: string; name: string; expected_annual_value: number | null };

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function BdReports() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const companyId = profile?.company_id;

  const { data, isLoading } = useQuery({
    queryKey: ["bd-report-v2", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [leadsR, eventsR, clientsR] = await Promise.all([
        supabase.from("leads")
          .select("id, source, status, stage, expected_value, proposal_id, event_id, created_at")
          .eq("company_id", companyId!).is("deleted_at", null),
        supabase.from("bd_events").select("id, name").eq("company_id", companyId!),
        supabase.from("clients").select("id, name, expected_annual_value").eq("company_id", companyId!),
      ]);
      if (leadsR.error) throw leadsR.error;
      if (eventsR.error) throw eventsR.error;
      if (clientsR.error) throw clientsR.error;
      return {
        leads: (leadsR.data || []) as Lead[],
        events: (eventsR.data || []) as Event[],
        clients: (clientsR.data || []) as Client[],
      };
    },
  });

  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const { leads, events, clients } = data;
  const total = leads.length;
  const isConverted = (l: Lead) => l.status === "converted" || !!l.proposal_id;
  const isWon = (l: Lead) => l.stage === "WON";
  const converted = leads.filter(isConverted).length;
  const overallRate = total ? Math.round((converted / total) * 100) : 0;

  // KPIs
  const since30 = Date.now() - 30 * 86400_000;
  const capturedRecent = leads.filter((l) => new Date(l.created_at).getTime() >= since30).length;
  const pipelineGenerated = leads
    .filter((l) => l.stage !== "LOST")
    .reduce((s, l) => s + Number(l.expected_value || 0), 0);
  const convertedValue = leads.filter(isWon)
    .reduce((s, l) => s + Number(l.expected_value || 0), 0);
  const relationshipPipeline = clients
    .reduce((s, c) => s + Number(c.expected_annual_value || 0), 0);

  // Source breakdown
  const bySource = new Map<string, { total: number; converted: number; value: number }>();
  for (const l of leads) {
    const k = l.source || "Unknown";
    const cur = bySource.get(k) || { total: 0, converted: 0, value: 0 };
    cur.total += 1;
    if (isConverted(l)) { cur.converted += 1; cur.value += Number(l.expected_value || 0); }
    bySource.set(k, cur);
  }
  const sourceRows = Array.from(bySource.entries())
    .map(([source, v]) => ({ source, ...v, rate: v.total ? Math.round((v.converted / v.total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  // Event rollup
  const eventMap = new Map(events.map((e) => [e.id, e.name]));
  const byEvent = new Map<string, { id: string; name: string; captured: number; pipeline: number; converted: number }>();
  for (const l of leads) {
    if (!l.event_id) continue;
    const name = eventMap.get(l.event_id) || "(deleted event)";
    const cur = byEvent.get(l.event_id) || { id: l.event_id, name, captured: 0, pipeline: 0, converted: 0 };
    cur.captured += 1;
    if (l.stage !== "LOST") cur.pipeline += Number(l.expected_value || 0);
    if (isWon(l)) cur.converted += Number(l.expected_value || 0);
    byEvent.set(l.event_id, cur);
  }
  const eventRows = Array.from(byEvent.values()).sort((a, b) => b.pipeline - a.pipeline);

  const stages = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
  const byStage = new Map<string, number>();
  for (const l of leads) byStage.set(l.stage || "NEW", (byStage.get(l.stage || "NEW") || 0) + 1);

  const Kpi = ({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) => (
    <Card className={onClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""} onClick={onClick}>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold tabular-nums">{value}</div></CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label={`Leads captured (total · ${capturedRecent} in 30d)`}
          value={total}
          onClick={() => navigate("/bd/leads")}
        />
        <Kpi label="Pipeline generated" value={money(pipelineGenerated)} />
        <Kpi label="Converted $" value={money(convertedValue)} />
        <Kpi label="Conversion rate" value={`${overallRate}%`} />
        <Kpi label="Relationship pipeline" value={money(relationshipPipeline)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Stage Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stages.map((s) => {
              const count = byStage.get(s) || 0;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-muted-foreground">{s}</div>
                  <div className="flex-1 bg-muted rounded h-6 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-12 text-right text-sm font-medium tabular-nums">{count}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Event ROI</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Event</th>
              <th className="py-2 text-right">Leads captured</th>
              <th className="py-2 text-right">Pipeline</th>
              <th className="py-2 text-right">Converted $</th>
            </tr></thead>
            <tbody>
              {eventRows.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No leads attributed to events yet.</td></tr>
              ) : eventRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/bd/leads?event=${r.id}`)}>
                  <td className="py-2 font-medium text-primary underline-offset-2 hover:underline">{r.name}</td>
                  <td className="py-2 text-right tabular-nums">{r.captured}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.pipeline)}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.converted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top Sources by Converted Value</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Source</th>
              <th className="py-2 text-right">Leads</th>
              <th className="py-2 text-right">Converted</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Value</th>
            </tr></thead>
            <tbody>
              {sourceRows.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No leads yet.</td></tr>
              ) : sourceRows.map((r) => (
                <tr key={r.source} className="border-b cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/bd/leads?source=${encodeURIComponent(r.source)}`)}>
                  <td className="py-2 font-medium text-primary underline-offset-2 hover:underline">{r.source}</td>
                  <td className="py-2 text-right tabular-nums">{r.total}</td>
                  <td className="py-2 text-right tabular-nums">{r.converted}</td>
                  <td className="py-2 text-right tabular-nums">{r.rate}%</td>
                  <td className="py-2 text-right tabular-nums">{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
