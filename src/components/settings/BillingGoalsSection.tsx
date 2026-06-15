import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Target, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function BillingGoalsSection() {
  const { profile } = useAuth() as any;
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "admin";

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-billing-goals", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("weekly_billing_goal_override, monthly_billing_goal_override")
        .eq("id", profile.company_id)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: derived } = useQuery({
    queryKey: ["company-derived-goal", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("monthly_goal, role, is_active")
        .eq("company_id", profile.company_id)
        .eq("is_active", true);
      const monthly = (data || [])
        .filter((p: any) => ["pm", "admin", "manager", "production"].includes(p.role))
        .reduce((s: number, p: any) => s + (Number(p.monthly_goal) || 0), 0);
      return { monthly, weekly: monthly / 4.33 };
    },
  });

  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setWeekly(company.weekly_billing_goal_override ? String(company.weekly_billing_goal_override) : "");
      setMonthly(company.monthly_billing_goal_override ? String(company.monthly_billing_goal_override) : "");
    }
  }, [company]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          weekly_billing_goal_override: weekly ? Number(weekly) : null,
          monthly_billing_goal_override: monthly ? Number(monthly) : null,
        } as any)
        .eq("id", profile.company_id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["company-billing-goals"] });
      qc.invalidateQueries({ queryKey: ["billing-pulse"] });
      qc.invalidateQueries({ queryKey: ["company-monthly-goal"] });
      toast({ title: "Billing goals updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" /> Company Billing Goals
        </CardTitle>
        <CardDescription>
          By default, goals are summed from each active PM's monthly goal. Override here to set company-wide targets directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Weekly Goal Override ($)</Label>
                <Input
                  type="number"
                  value={weekly}
                  onChange={(e) => setWeekly(e.target.value)}
                  placeholder={derived ? `Default: $${Math.round(derived.weekly).toLocaleString()}` : "Sum of PM goals / 4.33"}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Goal Override ($)</Label>
                <Input
                  type="number"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  placeholder={derived ? `Default: $${Math.round(derived.monthly).toLocaleString()}` : "Sum of PM monthly goals"}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to use the derived total from team members' individual goals.
            </p>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Goals
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
