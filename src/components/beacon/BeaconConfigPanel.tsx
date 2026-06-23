import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Brain, ExternalLink, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function BeaconQuickStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["beacon-quick-stats"],
    queryFn: async () => {
      const [{ count: totalQuestions }, { data: confData }, { data: lastRow }] = await Promise.all([
        supabase.from("beacon_interactions").select("*", { count: "exact", head: true }),
        supabase.from("beacon_interactions").select("confidence").not("confidence", "is", null),
        supabase.from("beacon_interactions").select("timestamp").order("timestamp", { ascending: false }).limit(1),
      ]);
      const avgConf = confData && confData.length > 0
        ? Math.round(confData.reduce((s: number, r: any) => s + (Number(r.confidence) ?? 0), 0) / confData.length)
        : 0;
      const lastActivity = lastRow?.[0]?.timestamp ?? null;
      return { totalQuestions: totalQuestions ?? 0, avgConfidence: avgConf, lastActivity };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[hsl(142,71%,45%)]" /> Quick Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{isLoading ? "—" : data?.totalQuestions}</p>
            <p className="text-xs text-muted-foreground">Total Questions</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{isLoading ? "—" : `${data?.avgConfidence}%`}</p>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {isLoading || !data?.lastActivity ? "—" : new Date(data.lastActivity).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">Last Activity</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BeaconConfigPanel() {
  const navigate = useNavigate();
  const [backfilling, setBackfilling] = useState(false);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("backfill-project-summaries", {
        body: { force: false },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      toast.success(data?.message ?? `Backfill started for ${data?.total ?? 0} projects.`);
    } catch (e: any) {
      toast.error(`Backfill failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-[hsl(142,71%,45%)]" /> Railway Backend
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Connection Status</p>
              <p className="text-xs text-muted-foreground font-mono">https://beaconrag.up.railway.app</p>
            </div>
            <Badge className="bg-[hsl(142,71%,45%)] text-white text-[10px]">Connected</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Bot Name</p>
              <p className="text-xs text-muted-foreground">Google Chat App</p>
            </div>
            <span className="text-sm font-medium">Beacon</span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/beacon?tab=usage")}
          >
            <ExternalLink className="h-4 w-4 mr-2" /> View Beacon Analytics
          </Button>
          <Separator />
          <div className="p-3 border rounded-lg space-y-2">
            <p className="text-sm font-medium">Backfill Project AI Notes</p>
            <p className="text-xs text-muted-foreground">
              One-time action: generate AI summary notes for every open project so Beacon can answer questions about them.
            </p>
            <Button onClick={handleBackfill} disabled={backfilling} className="w-full">
              {backfilling ? "Backfilling…" : "Run Backfill"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <BeaconQuickStats />
    </div>
  );
}
