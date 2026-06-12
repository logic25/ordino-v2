import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RfpReports() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const { data, isLoading } = useQuery({
    queryKey: ["rfp-report", companyId],
    queryFn: async () => {
      const [{ data: rfps }, { data: discovered }, { data: outreach }] = await Promise.all([
        supabase.from("rfps").select("id, agency, status, outcome, contract_value, submitted_at").eq("company_id", companyId!),
        supabase.from("discovered_rfps").select("id, status, rfp_id").eq("company_id", companyId!),
        supabase.from("rfp_partner_outreach").select("id, response_status, responded_at").eq("company_id", companyId!),
      ]);
      return {
        rfps: rfps || [],
        discovered: discovered || [],
        outreach: outreach || [],
      };
    },
    enabled: !!companyId,
  });

  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const discoveredCount = data.discovered.length;
  const respondedCount = data.rfps.filter((r) => !!r.submitted_at).length;
  const wonCount = data.rfps.filter((r) => r.outcome === "won").length;
  const totalWonValue = data.rfps
    .filter((r) => r.outcome === "won")
    .reduce((s, r) => s + Number(r.contract_value || 0), 0);

  // Win rate by agency
  const byAgency = new Map<string, { responded: number; won: number; value: number }>();
  for (const r of data.rfps) {
    const key = r.agency || "Unknown";
    const cur = byAgency.get(key) || { responded: 0, won: 0, value: 0 };
    if (r.submitted_at) cur.responded += 1;
    if (r.outcome === "won") {
      cur.won += 1;
      cur.value += Number(r.contract_value || 0);
    }
    byAgency.set(key, cur);
  }
  const agencyRows = Array.from(byAgency.entries())
    .map(([agency, v]) => ({ agency, ...v, rate: v.responded ? Math.round((v.won / v.responded) * 100) : 0 }))
    .sort((a, b) => b.won - a.won);

  // Partner outreach
  const outreachTotal = data.outreach.length;
  const outreachResponded = data.outreach.filter((o) => !!o.responded_at).length;
  const outreachRate = outreachTotal ? Math.round((outreachResponded / outreachTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Discovered</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{discoveredCount}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Responded</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{respondedCount}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{wonCount}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Won Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${totalWonValue.toLocaleString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Outreach</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {outreachResponded} of {outreachTotal} partner notifications responded — <span className="font-medium text-foreground">{outreachRate}%</span> response rate.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Win Rate by Agency</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Agency</th>
                <th className="py-2 text-right">Responded</th>
                <th className="py-2 text-right">Won</th>
                <th className="py-2 text-right">Win Rate</th>
                <th className="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {agencyRows.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No RFP responses yet.</td></tr>
              )}
              {agencyRows.map((r) => (
                <tr key={r.agency} className="border-b">
                  <td className="py-2 font-medium">{r.agency}</td>
                  <td className="py-2 text-right">{r.responded}</td>
                  <td className="py-2 text-right">{r.won}</td>
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
