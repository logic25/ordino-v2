import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export function ExpensesSettings() {
  const { data: profiles = [] } = useCompanyProfiles();
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState<string>("250");
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof?.company_id) return;
      setCompanyId(prof.company_id);
      const { data: co } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", prof.company_id)
        .maybeSingle();
      const s = (co?.settings as any) || {};
      setThreshold(String(s.expense_auto_approve_threshold ?? 250));
      setApproverIds(Array.isArray(s.expense_approver_ids) ? s.expense_approver_ids : []);
      setLoading(false);
    })();
  }, []);

  const adminProfiles = profiles.filter((p: any) => (p.role === "admin" || p.role === "manager") && p.is_active);

  const toggleApprover = (id: string) => {
    setApproverIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { data: co } = await supabase.from("companies").select("settings").eq("id", companyId).maybeSingle();
      const merged = {
        ...((co?.settings as any) || {}),
        expense_auto_approve_threshold: Number(threshold) || 0,
        expense_approver_ids: approverIds,
      };
      const { error } = await supabase.from("companies").update({ settings: merged } as any).eq("id", companyId);
      if (error) throw error;
      toast({ title: "Expense settings saved" });
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Approve Threshold</CardTitle>
          <CardDescription>
            Expenses requested for approval under this amount are approved automatically. Set to 0 to always require approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="threshold">Threshold ($)</Label>
              <Input id="threshold" type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approvers</CardTitle>
          <CardDescription>
            Admins who receive an email and in-app notification when an expense needs approval. If none selected, all active admins are notified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active admins found.</p>
          ) : (
            <div className="space-y-2">
              {adminProfiles.map((p: any) => (
                <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={approverIds.includes(p.id)} onCheckedChange={() => toggleApprover(p.id)} />
                  <span className="text-sm">{p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
