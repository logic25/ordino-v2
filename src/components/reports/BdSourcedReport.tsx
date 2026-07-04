import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useBdSourcedSummary } from "@/hooks/useBdComp";
import { money } from "@/lib/bdComp";

export default function BdSourcedReport() {
  const { data, isLoading } = useBdSourcedSummary(90);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" /> BD Sourced — last 90 days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold">{data.count}</div>
              <div className="text-xs text-muted-foreground">BD-sourced leads</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{data.conversionPct}%</div>
              <div className="text-xs text-muted-foreground">→ Qualified</div>
              <Badge variant="outline" className="mt-1 text-[10px]">{data.qualified} qualified</Badge>
            </div>
            <div>
              <div className="text-2xl font-semibold">{money(data.activeProposalValue)}</div>
              <div className="text-xs text-muted-foreground">$ in active proposals</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
