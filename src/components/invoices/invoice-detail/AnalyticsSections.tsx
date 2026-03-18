import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { BarChart3, ChevronDown, TrendingUp, HandCoins } from "lucide-react";
import { format } from "date-fns";

interface PaymentAnalyticsSectionProps {
  clientAnalytics: any;
}

export function PaymentAnalyticsSection({ clientAnalytics }: PaymentAnalyticsSectionProps) {
  if (!clientAnalytics) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full group">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">Payment Analytics</h4>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Reliability Score</p>
              <p className="text-lg font-bold tabular-nums">{clientAnalytics.payment_reliability_score != null ? `${clientAnalytics.payment_reliability_score}/100` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Avg Days to Pay</p>
              <p className="text-lg font-bold tabular-nums">{clientAnalytics.avg_days_to_payment != null ? `${clientAnalytics.avg_days_to_payment}d` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Lifetime Value</p>
              <p className="text-lg font-bold tabular-nums">${(clientAnalytics.total_lifetime_value || 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Last 12mo</p>
              <p className="text-sm font-medium">{clientAnalytics.last_12mo_paid_on_time ?? 0} on time / {clientAnalytics.last_12mo_late ?? 0} late</p>
            </div>
          </div>
          {clientAnalytics.longest_days_late != null && clientAnalytics.longest_days_late > 0 && (
            <p className="text-xs text-muted-foreground">Longest late: {clientAnalytics.longest_days_late} days • Responds to reminders: {clientAnalytics.responds_to_reminders ? "Yes" : "No"}</p>
          )}
          {clientAnalytics.preferred_contact_method && (
            <p className="text-xs text-muted-foreground">Preferred contact: {clientAnalytics.preferred_contact_method}{clientAnalytics.best_contact_time ? ` (${clientAnalytics.best_contact_time})` : ""}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface RiskPredictionSectionProps {
  prediction: any;
}

export function RiskPredictionSection({ prediction }: RiskPredictionSectionProps) {
  if (!prediction) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full group">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">AI Risk Assessment</h4>
          <Badge variant="outline" className={`text-[10px] tabular-nums ${
            prediction.risk_score >= 80 ? "text-destructive bg-destructive/10 border-destructive/30"
            : prediction.risk_score >= 60 ? "text-warning bg-warning/10 border-warning/30"
            : prediction.risk_score >= 40 ? "text-amber-600 bg-amber-50 border-amber-200"
            : "text-emerald-600 bg-emerald-50 border-emerald-200"
          }`}>Risk {prediction.risk_score}</Badge>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Est. Payment</p>
              <p className="font-medium">{prediction.predicted_payment_date ? format(new Date(prediction.predicted_payment_date), "MMM d, yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Est. Days Late</p>
              <p className="font-medium">{prediction.predicted_days_late ?? "—"}</p>
            </div>
          </div>
          {prediction.factors && Object.keys(prediction.factors).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-muted-foreground font-medium">Risk Factors</p>
              {Object.entries(prediction.factors).map(([key, val]) => (
                <p key={key} className="text-xs text-muted-foreground">• {val as string}</p>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface PromisesSectionProps {
  promises: any[] | undefined;
}

export function PromisesSection({ promises }: PromisesSectionProps) {
  if (!promises || promises.length === 0) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full group">
        <div className="flex items-center gap-2">
          <HandCoins className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">Promises to Pay</h4>
          <Badge variant="outline" className="text-[10px]">{promises.length}</Badge>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="space-y-2">
          {promises.map((p) => {
            const isPast = new Date(p.promised_date) < new Date();
            const statusColor = p.status === "broken" ? "text-destructive"
              : p.status === "kept" ? "text-emerald-600"
              : isPast ? "text-destructive"
              : "text-primary";
            return (
              <div key={p.id} className="rounded-md border p-2.5 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                      {p.status === "broken" ? "⚠ Broken" : p.status === "kept" ? "✓ Kept" : isPast ? "⚠ Overdue" : "Pending"}
                    </Badge>
                    <span className="tabular-nums font-medium text-sm">${p.promised_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">by {format(new Date(p.promised_date), "MMM d, yyyy")}</span>
                </div>
                <p className="text-xs text-muted-foreground">via {p.payment_method || "—"} • source: {p.source}</p>
                {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
