import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Briefcase, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings, type ServiceCatalogItem } from "@/hooks/useCompanySettings";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface PMGoalData {
  id: string;
  name: string;
  projectCount: number;
  weightedWorkload: number;
  maxCapacity: number;
  serviceMix: { name: string; count: number }[];
  billedThisMonth: number;
  smartTarget: number;
  utilization: number;
}

function usePMBillingGoals() {
  const { data: companyData } = useCompanySettings();
  const catalog = companyData?.settings?.service_catalog || [];

  return useQuery({
    queryKey: ["pm-billing-goals", companyData?.companyId, catalog.length],
    enabled: !!companyData?.companyId,
    queryFn: async () => {
      // Get all PMs
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, display_name, role, monthly_goal")
        .eq("is_active", true)
        .in("role", ["pm", "admin", "manager"]);

      const pms = (profiles || []).filter((p: any) => p.role === "pm" || p.role === "admin" || p.role === "manager");

      // Get active projects with services
      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id, status")
        .eq("status", "open");

      // Get project services
      const { data: projectServices } = await supabase
        .from("services")
        .select("id, project_id, service_name, fee, status");

      // Get checklist items for readiness
      const { data: checklistItems } = await supabase
        .from("project_checklist_items")
        .select("id, project_id, is_complete");

      // Get invoices this month
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd'T'23:59:59");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, project_id, total_due, created_at")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      // Build catalog weight map
      const weightMap: Record<string, number> = {};
      (catalog as ServiceCatalogItem[]).forEach((s) => {
        weightMap[s.name.toLowerCase()] = (s as any).complexity_weight || 1;
      });

      // Build PM data
      const pmData: PMGoalData[] = pms.map((pm: any) => {
        const pmProjects = (projects || []).filter((p: any) => p.assigned_pm_id === pm.id);
        const pmProjectIds = new Set(pmProjects.map((p: any) => p.id));

        // Services on PM's projects
        const pmServices = (projectServices || []).filter(
          (s: any) => pmProjectIds.has(s.project_id) && s.status !== "cancelled"
        );

        // Weighted workload
        let weightedWorkload = 0;
        const serviceCounts: Record<string, number> = {};
        let totalServiceValue = 0;

        pmServices.forEach((s: any) => {
          const name = (s.service_name || "").toLowerCase();
          const weight = weightMap[name] || 1;
          weightedWorkload += weight;
          serviceCounts[s.service_name || "Other"] = (serviceCounts[s.service_name || "Other"] || 0) + 1;
          totalServiceValue += s.fee || 0;
        });

        const serviceMix = Object.entries(serviceCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Checklist readiness
        const pmChecklist = (checklistItems || []).filter((c: any) => pmProjectIds.has(c.project_id));
        const totalItems = pmChecklist.length;
        const completedItems = pmChecklist.filter((c: any) => c.is_complete).length;
        const readiness = totalItems > 0 ? completedItems / totalItems : 0;

        // Billed this month
        const pmInvoices = (invoices || []).filter((inv: any) => pmProjectIds.has(inv.project_id));
        const billedThisMonth = pmInvoices.reduce((s: number, inv: any) => s + (inv.total_due || 0), 0);

        // Smart target = total service value * readiness
        const smartTarget = Math.round(totalServiceValue * readiness);

        // Max capacity (from monthly_goal or default 100)
        const maxCapacity = pm.monthly_goal || 100;
        const utilization = maxCapacity > 0 ? Math.round((weightedWorkload / maxCapacity) * 100) : 0;

        const name = pm.display_name || `${pm.first_name || ""} ${pm.last_name || ""}`.trim() || "Unknown";

        return {
          id: pm.id,
          name,
          projectCount: pmProjects.length,
          weightedWorkload: Math.round(weightedWorkload),
          maxCapacity,
          serviceMix,
          billedThisMonth,
          smartTarget,
          utilization,
        };
      });

      return pmData
        .filter((pm) => pm.projectCount > 0 || pm.billedThisMonth > 0)
        .sort((a, b) => b.weightedWorkload - a.weightedWorkload);
    },
  });
}

function getProgressColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-destructive";
}

export function BillingGoalTracker() {
  const { data: pmData, isLoading } = usePMBillingGoals();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-5 w-5" />
          PM Billing Capacity
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1.5 p-3">
                <p className="font-semibold">How this is calculated:</p>
                <p><span className="font-medium">Weighted Workload</span> — each active service is assigned a complexity weight (1–10). The PM's total workload is the sum of all their services' weights.</p>
                <p><span className="font-medium">Monthly Goal ($)</span> — the PM's configured monthly billing target in dollars.</p>
                <p><span className="font-medium">Billing Progress</span> — invoices created this month on the PM's projects vs. their smart target (total service value × checklist readiness %).</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Complexity-weighted workload and billing progress per PM
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : !pmData || pmData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No PM data available. Assign PMs to projects to see capacity tracking.
          </p>
        ) : (
          <div className="space-y-4">
            {pmData.map((pm) => {
              const billingPct = pm.smartTarget > 0 ? Math.min(100, Math.round((pm.billedThisMonth / pm.smartTarget) * 100)) : 0;
              return (
                <div key={pm.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{pm.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> {pm.projectCount} projects
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {pm.weightedWorkload} pts · ${pm.maxCapacity.toLocaleString()} goal
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${getProgressColor(billingPct)}`}>
                        ${pm.billedThisMonth.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        of ${pm.smartTarget.toLocaleString()} target
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Billing Progress</span>
                      <span>{billingPct}%</span>
                    </div>
                    <Progress value={billingPct} className="h-2" />
                  </div>

                  {/* Service mix */}
                  {pm.serviceMix.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {pm.serviceMix.slice(0, 5).map((s) => (
                        <Badge key={s.name} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {s.count}× {s.name}
                        </Badge>
                      ))}
                      {pm.serviceMix.length > 5 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          +{pm.serviceMix.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
