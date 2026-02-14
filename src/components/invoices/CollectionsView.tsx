import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { AlertTriangle, AlertOctagon, Clock, Mail, FileWarning, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";

interface CollectionsViewProps {
  invoices: InvoiceWithRelations[];
  onViewInvoice: (invoice: InvoiceWithRelations) => void;
  onSendReminder?: (invoice: InvoiceWithRelations) => void;
}

interface GroupedInvoice extends InvoiceWithRelations {
  daysOverdue: number;
}

type UrgencyLevel = "critical" | "urgent" | "attention";

const urgencyConfig: Record<UrgencyLevel, {
  label: string;
  description: string;
  icon: typeof AlertOctagon;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  critical: {
    label: "Critical — 90+ Days",
    description: "Consider demand letter or write-off",
    icon: AlertOctagon,
    colorClass: "text-destructive",
    bgClass: "bg-destructive/10",
    borderClass: "border-destructive/30",
  },
  urgent: {
    label: "Urgent — 60–90 Days",
    description: "Escalate follow-up immediately",
    icon: AlertTriangle,
    colorClass: "text-orange-500",
    bgClass: "bg-orange-50 dark:bg-orange-500/10",
    borderClass: "border-orange-300 dark:border-orange-500/30",
  },
  attention: {
    label: "Attention — 30–60 Days",
    description: "Send payment reminder",
    icon: Clock,
    colorClass: "text-yellow-600 dark:text-yellow-500",
    bgClass: "bg-yellow-50 dark:bg-yellow-500/10",
    borderClass: "border-yellow-300 dark:border-yellow-500/30",
  },
};

export function CollectionsView({ invoices, onViewInvoice, onSendReminder }: CollectionsViewProps) {
  const grouped = useMemo(() => {
    const now = new Date();
    const withDays: GroupedInvoice[] = invoices
      .filter((inv) => inv.status === "overdue" || inv.status === "sent")
      .map((inv) => ({
        ...inv,
        daysOverdue: inv.due_date
          ? Math.max(0, differenceInDays(now, new Date(inv.due_date)))
          : differenceInDays(now, new Date(inv.created_at)),
      }))
      .filter((inv) => inv.daysOverdue >= 30)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return {
      critical: withDays.filter((i) => i.daysOverdue >= 90),
      urgent: withDays.filter((i) => i.daysOverdue >= 60 && i.daysOverdue < 90),
      attention: withDays.filter((i) => i.daysOverdue >= 30 && i.daysOverdue < 60),
    };
  }, [invoices]);

  const totalAmount = useMemo(() => {
    const all = [...grouped.critical, ...grouped.urgent, ...grouped.attention];
    return all.reduce((sum, inv) => sum + Number(inv.total_due), 0);
  }, [grouped]);

  const totalCount = grouped.critical.length + grouped.urgent.length + grouped.attention.length;

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <h3 className="text-lg font-medium">No collections items</h3>
        <p className="text-muted-foreground mt-1">
          All invoices are within normal payment terms
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {totalCount} invoice{totalCount !== 1 ? "s" : ""} in collections
          </p>
          <p className="text-2xl font-bold font-mono mt-0.5">
            ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-destructive font-bold text-lg">{grouped.critical.length}</p>
            <p className="text-muted-foreground text-xs">Critical</p>
          </div>
          <div className="text-center">
            <p className="text-orange-500 font-bold text-lg">{grouped.urgent.length}</p>
            <p className="text-muted-foreground text-xs">Urgent</p>
          </div>
          <div className="text-center">
            <p className="text-yellow-600 dark:text-yellow-500 font-bold text-lg">{grouped.attention.length}</p>
            <p className="text-muted-foreground text-xs">Attention</p>
          </div>
        </div>
      </div>

      {/* Urgency groups */}
      {(["critical", "urgent", "attention"] as UrgencyLevel[]).map((level) => {
        const items = grouped[level];
        if (items.length === 0) return null;
        const config = urgencyConfig[level];
        const Icon = config.icon;

        return (
          <Card key={level} className={`border ${config.borderClass}`}>
            <CardHeader className={`pb-3 ${config.bgClass} rounded-t-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${config.colorClass}`} />
                  <div>
                    <CardTitle className={`text-sm font-semibold ${config.colorClass}`}>
                      {config.label}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className={config.colorClass}>
                  {items.length} invoice{items.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-2">
                {items.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onViewInvoice(inv)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
                          <InvoiceStatusBadge status={inv.status} />
                          <Badge variant="secondary" className="text-[10px]">
                            {inv.daysOverdue} days
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {inv.clients?.name || "Unknown client"}
                          {inv.projects?.name ? ` • ${inv.projects.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium text-sm">
                        ${Number(inv.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => onSendReminder?.(inv)}
                          title="Send Reminder"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                        {level === "critical" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive"
                              title="Send Demand Letter"
                            >
                              <FileWarning className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-muted-foreground"
                              title="Write Off"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
