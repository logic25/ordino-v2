import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, DollarSign, Target } from "lucide-react";
import type { Rfp } from "@/hooks/useRfps";

interface RfpSummaryCardsProps {
  rfps: Rfp[];
}

export function RfpSummaryCards({ rfps }: RfpSummaryCardsProps) {
  const stats = useMemo(() => {
    const active = rfps.filter((r) => ["prospect", "drafting", "submitted"].includes(r.status));
    const won = rfps.filter((r) => r.status === "won");
    const lost = rfps.filter((r) => r.status === "lost");
    const decided = won.length + lost.length;
    const winRate = decided > 0 ? Math.round((won.length / decided) * 100) : 0;
    const pipelineValue = active.reduce((sum, r) => sum + (r.contract_value || 0), 0);
    const wonValue = won.reduce((sum, r) => sum + (r.contract_value || 0), 0);

    return {
      total: rfps.length,
      activeCount: active.length,
      closedCount: decided,
      winRate,
      wonCount: won.length,
      decided,
      pipelineValue,
      wonValue,
    };
  }, [rfps]);

  const cards = [
    {
      label: "Total RFPs",
      value: stats.total,
      detail: `${stats.activeCount} active · ${stats.closedCount} closed`,
      icon: Target,
    },
    {
      label: "Win Rate",
      value: `${stats.winRate}%`,
      detail: `${stats.wonCount} of ${stats.decided} decided`,
      icon: Trophy,
    },
    {
      label: "Active Pipeline",
      value: `$${stats.pipelineValue.toLocaleString()}`,
      detail: `${stats.activeCount} opportunities`,
      icon: TrendingUp,
    },
    {
      label: "Secured",
      value: `$${stats.wonValue.toLocaleString()}`,
      detail: `${stats.wonCount} won`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <card.icon className="h-3.5 w-3.5" />
              {card.label}
            </div>
            <div className="text-2xl font-bold tabular-nums">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
