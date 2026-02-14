import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, TrendingUp, DollarSign, Target } from "lucide-react";
import type { Rfp } from "@/hooks/useRfps";

export type RfpFilter = "all" | "active" | "won" | "lost" | null;

interface RfpSummaryCardsProps {
  rfps: Rfp[];
  activeFilter: RfpFilter;
  onFilterChange: (filter: RfpFilter) => void;
}

export function RfpSummaryCards({ rfps, activeFilter, onFilterChange }: RfpSummaryCardsProps) {
  const stats = useMemo(() => {
    const active = rfps.filter((r) => ["prospect", "drafting", "submitted"].includes(r.status));
    const won = rfps.filter((r) => r.status === "won");
    const lost = rfps.filter((r) => r.status === "lost");
    const decided = won.length + lost.length;
    const winRate = decided > 0 ? Math.round((won.length / decided) * 100) : 0;
    const pipelineValue = active.reduce((sum, r) => sum + (r.contract_value || 0), 0);
    const wonValue = won.reduce((sum, r) => sum + (r.contract_value || 0), 0);
    const totalValue = rfps.reduce((sum, r) => sum + (r.contract_value || 0), 0);

    return { total: rfps.length, activeCount: active.length, winRate, wonCount: won.length, lostCount: lost.length, decided, pipelineValue, wonValue, totalValue };
  }, [rfps]);

  const cards: { key: RfpFilter; label: string; value: string | number; detail: string; icon: typeof Target; tooltip: string }[] = [
    {
      key: "all",
      label: "Total RFPs",
      value: stats.total,
      detail: `$${stats.totalValue.toLocaleString()} total value`,
      icon: Target,
      tooltip: "All RFPs across every status. Click to show all in the table.",
    },
    {
      key: "active",
      label: "Pipeline Value",
      value: `$${stats.pipelineValue.toLocaleString()}`,
      detail: `${stats.activeCount} active opportunities`,
      icon: TrendingUp,
      tooltip: "Total contract value of RFPs in Prospect, Drafting, or Submitted status. Click to filter.",
    },
    {
      key: "won",
      label: "Secured",
      value: `$${stats.wonValue.toLocaleString()}`,
      detail: `${stats.wonCount} won · ${stats.winRate}% win rate`,
      icon: DollarSign,
      tooltip: "Total contract value of won RFPs. Click to filter to won only.",
    },
    {
      key: "lost",
      label: "Win Rate",
      value: `${stats.winRate}%`,
      detail: `${stats.wonCount} won · ${stats.lostCount} lost`,
      icon: Trophy,
      tooltip: "Percentage of decided RFPs (won + lost) that were won. Click to see lost RFPs.",
    },
  ];

  const handleClick = (key: RfpFilter) => {
    onFilterChange(activeFilter === key ? null : key);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Tooltip key={card.key}>
            <TooltipTrigger asChild>
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === card.key ? "ring-2 ring-primary shadow-md" : ""}`}
                onClick={() => handleClick(card.key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <card.icon className="h-3.5 w-3.5" />
                    {card.label}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.detail}</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              {card.tooltip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
