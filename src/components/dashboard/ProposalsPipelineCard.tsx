import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useProposalsPipeline } from "@/hooks/useDashboardData";
import { formatCompactCurrency } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  draft: "bg-muted",
  sent: "bg-primary/70",
  signed_client: "bg-accent",
  executed: "bg-emerald-500",
  lost: "bg-destructive/60",
};

export function ProposalsPipelineCard() {
  const navigate = useNavigate();
  const { data: stages = [], isLoading } = useProposalsPipeline();

  const totalValue = stages.reduce((s, x) => s + x.value, 0);
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proposals Pipeline</CardTitle>
        <CardDescription>
          Counts and value by stage · {formatCompactCurrency(totalValue)} total
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          stages.map((stage) => {
            const pct = (stage.count / maxCount) * 100;
            return (
              <button
                key={stage.status}
                onClick={() => navigate(`/proposals?status=${stage.status}`)}
                className="w-full text-left group rounded-md p-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{stage.label}</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className="font-semibold text-foreground">{stage.count}</span>
                    <span>·</span>
                    <span>{formatCompactCurrency(stage.value)}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div
                    className={`h-full ${STAGE_COLORS[stage.status] || "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
