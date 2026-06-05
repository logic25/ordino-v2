import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Bell, AlertTriangle, Save } from "lucide-react";

export function AIBudgetSettings() {
  const { profile } = useAuth();
  const companyId = (profile as any)?.company_id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [cap, setCap] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(80);
  const [emails, setEmails] = useState<string>("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-budget-settings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_budget_settings" as any)
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      return data as any;
    },
  });

  // Month-to-date usage
  const { data: mtdCost = 0 } = useQuery({
    queryKey: ["ai-mtd-cost", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("ai_usage_logs" as any)
        .select("estimated_cost_usd")
        .eq("company_id", companyId)
        .gte("created_at", start.toISOString());
      return (data || []).reduce((s: number, r: any) => s + (parseFloat(r.estimated_cost_usd) || 0), 0);
    },
  });

  useEffect(() => {
    if (settings) {
      setCap(settings.monthly_cap_usd?.toString() || "");
      setThreshold(settings.alert_threshold_pct || 80);
      setEmails((settings.alert_emails || []).join(", "));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: companyId,
        monthly_cap_usd: cap ? Number(cap) : null,
        alert_threshold_pct: threshold,
        alert_emails: emails.split(",").map(e => e.trim()).filter(Boolean),
      };
      if (settings?.id) {
        await supabase.from("ai_budget_settings" as any).update(payload).eq("id", settings.id);
      } else {
        await supabase.from("ai_budget_settings" as any).insert(payload);
      }
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "AI budget settings updated." });
      qc.invalidateQueries({ queryKey: ["ai-budget-settings"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const capNum = cap ? Number(cap) : 0;
  const pct = capNum > 0 ? Math.min(Math.round((mtdCost / capNum) * 100), 200) : 0;
  const overThreshold = capNum > 0 && pct >= threshold;
  const overCap = capNum > 0 && mtdCost >= capNum;

  if (isLoading) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> AI Spend Budget
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current MTD status */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-muted-foreground">Month-to-date spend</span>
            <span className="text-2xl font-bold tabular-nums">${mtdCost.toFixed(2)}</span>
          </div>
          {capNum > 0 && (
            <>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${overCap ? "bg-red-500" : overThreshold ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-muted-foreground">{pct}% of ${capNum.toFixed(0)} cap</span>
                {overCap ? <Badge variant="destructive" className="text-[10px]">Over budget</Badge>
                  : overThreshold ? <Badge className="bg-amber-500 text-[10px]">Alert threshold reached</Badge>
                  : <Badge variant="outline" className="text-[10px]">On track</Badge>}
              </div>
            </>
          )}
        </div>

        {/* Monthly cap */}
        <div className="space-y-1.5">
          <Label className="text-xs">Monthly spend cap (USD)</Label>
          <Input
            type="number"
            placeholder="e.g. 100"
            value={cap}
            onChange={e => setCap(e.target.value)}
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Leave blank for no cap. Used for alerts only — does not block AI calls.</p>
        </div>

        {/* Alert threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Alert me at</Label>
            <span className="text-sm font-medium tabular-nums">{threshold}%</span>
          </div>
          <Slider
            value={[threshold]}
            onValueChange={(v) => setThreshold(v[0])}
            min={50}
            max={100}
            step={5}
          />
        </div>

        {/* Recipients */}
        <div className="space-y-1.5">
          <Label className="text-xs">Alert email recipients</Label>
          <Input
            placeholder="admin@example.com, finance@example.com"
            value={emails}
            onChange={e => setEmails(e.target.value)}
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Comma-separated.</p>
        </div>

        {overCap && (
          <div className="flex gap-2 items-start rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-3">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-900 dark:text-red-200">You've passed your monthly cap. Review the top spenders below and consider switching high-volume features to Flash-Lite.</p>
          </div>
        )}

        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
