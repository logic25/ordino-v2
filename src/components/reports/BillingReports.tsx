import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBillingReports } from "@/hooks/useReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { DollarSign } from "lucide-react";

const DONUT_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(142, 76%, 36%)", "hsl(45, 93%, 47%)"];

function useRevenueByServiceType() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["revenue-by-service-type", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, total_due, payment_amount, status, project_id")
        .in("status", ["paid"]);

      if (!invoices || invoices.length === 0) return [];

      const projectIds = [...new Set(invoices.map((i: any) => i.project_id).filter(Boolean))];
      if (projectIds.length === 0) return [];

      const { data: services } = await supabase
        .from("services")
        .select("id, name, project_id")
        .in("project_id", projectIds);

      // Map project → primary service name
      const projectServiceMap: Record<string, string> = {};
      (services || []).forEach((s: any) => {
        if (!projectServiceMap[s.project_id]) projectServiceMap[s.project_id] = s.name;
      });

      const byService: Record<string, number> = {};
      invoices.forEach((inv: any) => {
        const svc = projectServiceMap[inv.project_id] || "Other";
        byService[svc] = (byService[svc] || 0) + (inv.payment_amount || inv.total_due || 0);
      });

      return Object.entries(byService)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
  });
}

function useTopOutstandingClients() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["top-outstanding-clients", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, client_id, total_due, payment_amount, status, clients!invoices_client_id_fkey(name)")
        .in("status", ["sent", "overdue"]);

      const clientMap: Record<string, { name: string; outstanding: number }> = {};
      (invoices || []).forEach((inv: any) => {
        const cid = inv.client_id;
        if (!cid) return;
        if (!clientMap[cid]) clientMap[cid] = { name: inv.clients?.name || "Unknown", outstanding: 0 };
        clientMap[cid].outstanding += (inv.total_due || 0) - (inv.payment_amount || 0);
      });

      return Object.values(clientMap).sort((a, b) => b.outstanding - a.outstanding).slice(0, 10);
    },
  });
}

export default function BillingReports() {
  const { data, isLoading } = useBillingReports();
  const { data: topClients, isLoading: clientsLoading } = useTopOutstandingClients();
  const { data: revenueByService, isLoading: svcLoading } = useRevenueByServiceType();

  if (isLoading || clientsLoading || svcLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const agingData = Object.entries(data.aging).map(([name, value]) => ({ name: name === "current" ? "0-30 days" : name + " days", value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Revenue Trend */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Collections KPIs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Collections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Collection Rate</p>
              <p className="text-3xl font-bold text-foreground">{data.collectionRate}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Days to Pay</p>
              <p className="text-3xl font-bold text-foreground">{data.avgDaysToPay}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="text-xl font-semibold text-foreground" data-clarity-mask="true">${data.totalCollected.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Service Type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue by Service Type</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByService && revenueByService.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={revenueByService} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ name, value }) => `${name}: $${(value / 1000).toFixed(0)}k`}>
                  {revenueByService.map((_: any, i: number) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <DollarSign className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Revenue by service will appear as invoices are paid</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Aging Report */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aging Report</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Clients by Outstanding */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Clients by Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients && topClients.length > 0 ? (
              <div data-clarity-mask="true">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topClients} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="outstanding" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No outstanding balances</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
