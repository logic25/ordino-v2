import { useQuery } from "@tanstack/react-query";
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
  created_at: string;
};

export default function BdReports() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const { data: leads, isLoading } = useQuery({
    queryKey: ["bd-report-leads", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, source, status, stage, expected_value, proposal_id, created_at")
        .eq("company_id", companyId!)
        .is("deleted_at", null);
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const rows = leads || [];
  const total = rows.length;
  const converted = rows.filter((l) => l.status === "converted" || !!l.proposal_id).length;
  const overallRate = total ? Math.round((converted / total) * 100) : 0;

  // By source
  const bySource = new Map<string, { total: number; converted: number; value: number }>();
  for (const l of rows) {
    const key = l.source || "Unknown";
    const cur = bySource.get(key) || { total: 0, converted: 0, value: 0 };
    cur.total += 1;
    const isConverted = l.status === "converted" || !!l.proposal_id;
    if (isConverted) {
      cur.converted += 1;
      cur.value += Number(l.expected_value || 0);
    }
    bySource.set(key, cur);
  }
  const sourceRows = Array.from(bySource.entries())
    .map(([source, v]) => ({
      source,
      ...v,
      rate: v.total ? Math.round((v.converted / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Stage funnel
  const stages = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
  const byStage = new Map<string, number>();
  for (const l of rows) {
    const s = l.stage || "NEW";
    byStage.set(s, (byStage.get(s) || 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{converted}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{overallRate}%</div></CardContent></Card>
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
                  <div className="w-12 text-right text-sm font-medium">{count}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top Sources by Converted Value</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Source</th>
                <th className="py-2 text-right">Leads</th>
                <th className="py-2 text-right">Converted</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No leads yet.</td></tr>
              )}
              {sourceRows.map((r) => (
                <tr key={r.source} className="border-b">
                  <td className="py-2 font-medium">{r.source}</td>
                  <td className="py-2 text-right">{r.total}</td>
                  <td className="py-2 text-right">{r.converted}</td>
                  <td className="py-2 text-right">{r.rate}%</td>
                  <td className="py-2 text-right">${r.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
