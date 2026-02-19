import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, DollarSign, Briefcase, TrendingUp } from "lucide-react";
import { startOfYear } from "date-fns";

function useReportsKPIs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-kpi-summary", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const [{ data: proposals }, { data: invoices }, { data: projects }] = await Promise.all([
        supabase.from("proposals").select("id, status, total_amount"),
        supabase.from("invoices").select("id, status, total_due, payment_amount, paid_at"),
        supabase.from("projects").select("id, status"),
      ]);

      const pendingProposals = (proposals || []).filter((p: any) => ["draft", "sent"].includes(p.status));
      const pendingProposalCount = pendingProposals.length;
      const pendingProposalValue = pendingProposals.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);

      const openInvoices = (invoices || []).filter((i: any) => ["sent", "overdue"].includes(i.status));
      const openInvoiceCount = openInvoices.length;
      const openInvoiceValue = openInvoices.reduce((s: number, i: any) => s + ((i.total_due || 0) - (i.payment_amount || 0)), 0);

      const activeProjects = (projects || []).filter((p: any) => p.status === "active").length;

      const ytdStart = startOfYear(new Date()).toISOString();
      const ytdCollected = (invoices || [])
        .filter((i: any) => i.status === "paid" && i.paid_at && i.paid_at >= ytdStart)
        .reduce((s: number, i: any) => s + (i.payment_amount || i.total_due || 0), 0);

      return { pendingProposalCount, pendingProposalValue, openInvoiceCount, openInvoiceValue, activeProjects, ytdCollected };
    },
  });
}

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v.toLocaleString()}`;

export default function ReportsKPISummary() {
  const { data, isLoading } = useReportsKPIs();

  if (isLoading || !data) return null;

  const kpis = [
    { label: "Pending Proposals", value: data.pendingProposalCount, sub: fmt(data.pendingProposalValue), icon: FileText },
    { label: "Open Invoices", value: data.openInvoiceCount, sub: fmt(data.openInvoiceValue), icon: DollarSign },
    { label: "Active Projects", value: data.activeProjects, icon: Briefcase },
    { label: "YTD Collected", value: fmt(data.ytdCollected), icon: TrendingUp },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <kpi.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
