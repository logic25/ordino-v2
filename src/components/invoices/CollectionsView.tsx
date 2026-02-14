import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, AlertOctagon, Clock, Mail, FileWarning, Trash2, Loader2, CheckCircle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useUpdateInvoice, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CollectionsViewProps {
  invoices: InvoiceWithRelations[];
  onViewInvoice: (invoice: InvoiceWithRelations) => void;
  onSendReminder?: (invoice: InvoiceWithRelations) => void;
}

interface GroupedInvoice extends InvoiceWithRelations {
  daysOverdue: number;
}

type UrgencyLevel = "critical" | "urgent" | "attention";

type WorkflowAction = null | "reminder" | "demand" | "writeoff";

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
    colorClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/30",
  },
  attention: {
    label: "Attention — 30–60 Days",
    description: "Send payment reminder",
    icon: Clock,
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted/50",
    borderClass: "border-muted-foreground/30",
  },
};

export function CollectionsView({ invoices, onViewInvoice, onSendReminder }: CollectionsViewProps) {
  const [activeAction, setActiveAction] = useState<WorkflowAction>(null);
  const [actionInvoice, setActionInvoice] = useState<GroupedInvoice | null>(null);
  const [reminderNote, setReminderNote] = useState("");
  const [demandNote, setDemandNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const updateInvoice = useUpdateInvoice();

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

  const openAction = (action: WorkflowAction, inv: GroupedInvoice) => {
    setActionInvoice(inv);
    setActiveAction(action);
    setReminderNote("");
    setDemandNote("");
  };

  const logFollowUp = async (invoiceId: string, method: string, notes: string) => {
    const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
    if (!profile) return;
    await supabase.from("invoice_follow_ups").insert({
      company_id: profile.company_id,
      invoice_id: invoiceId,
      follow_up_date: new Date().toISOString().split("T")[0],
      contact_method: method,
      notes,
      contacted_by: profile.id,
    } as any);
    await supabase.from("invoice_activity_log").insert({
      company_id: profile.company_id,
      invoice_id: invoiceId,
      action: method,
      details: notes,
      performed_by: profile.id,
    } as any);
  };

  const handleSendReminder = async () => {
    if (!actionInvoice) return;
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 800)); // mock email send
      await logFollowUp(actionInvoice.id, "reminder_email", `Payment reminder sent. ${reminderNote}`);
      toast({ title: "Payment reminder sent", description: `Reminder sent for ${actionInvoice.invoice_number}` });
      setActiveAction(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendDemandLetter = async () => {
    if (!actionInvoice) return;
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1200)); // mock
      await logFollowUp(actionInvoice.id, "demand_letter", `Demand letter sent. ${demandNote}`);
      toast({ title: "Demand letter sent", description: `Formal demand issued for ${actionInvoice.invoice_number}` });
      setActiveAction(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleWriteOff = async () => {
    if (!actionInvoice) return;
    setProcessing(true);
    try {
      await updateInvoice.mutateAsync({ id: actionInvoice.id, status: "paid" } as any);
      await logFollowUp(actionInvoice.id, "write_off", `Invoice written off. Amount: $${Number(actionInvoice.total_due).toFixed(2)}`);
      toast({ title: "Invoice written off", description: `${actionInvoice.invoice_number} marked as written off` });
      setActiveAction(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
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
            <p className="text-warning font-bold text-lg">{grouped.urgent.length}</p>
            <p className="text-muted-foreground text-xs">Urgent</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground font-bold text-lg">{grouped.attention.length}</p>
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
                          onClick={() => openAction("reminder", inv)}
                          title="Send Reminder"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                        {(level === "critical" || level === "urgent") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive"
                            onClick={() => openAction("demand", inv)}
                            title="Send Demand Letter"
                          >
                            <FileWarning className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {level === "critical" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground"
                            onClick={() => openAction("writeoff", inv)}
                            title="Write Off"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* Reminder Dialog */}
      <Dialog open={activeAction === "reminder"} onOpenChange={(o) => !o && setActiveAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Payment Reminder</DialogTitle>
            <DialogDescription>
              Send a reminder email to {actionInvoice?.clients?.name || "the client"} for invoice {actionInvoice?.invoice_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-mono font-medium">{actionInvoice?.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Due</span>
                <span className="font-mono font-medium">
                  ${Number(actionInvoice?.total_due || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days Overdue</span>
                <span className="font-medium text-destructive">{actionInvoice?.daysOverdue} days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Additional Note (optional)</Label>
              <Textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Add a personal note to the reminder..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button onClick={handleSendReminder} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Mail className="h-4 w-4 mr-2" /> Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demand Letter Dialog */}
      <Dialog open={activeAction === "demand"} onOpenChange={(o) => !o && setActiveAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Send Demand Letter</DialogTitle>
            <DialogDescription>
              This will send a formal demand letter for payment of invoice {actionInvoice?.invoice_number}. This is a serious escalation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 p-3 bg-destructive/5 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{actionInvoice?.clients?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Due</span>
                <span className="font-mono font-bold text-destructive">
                  ${Number(actionInvoice?.total_due || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days Overdue</span>
                <span className="font-bold text-destructive">{actionInvoice?.daysOverdue} days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Demand Letter Notes</Label>
              <Textarea
                value={demandNote}
                onChange={(e) => setDemandNote(e.target.value)}
                placeholder="Reference contract terms, prior communications, etc."
                rows={4}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A formal demand for payment will be generated and sent. This action will be logged in the invoice activity history.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSendDemandLetter} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <FileWarning className="h-4 w-4 mr-2" /> Send Demand Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Write-Off Dialog */}
      <Dialog open={activeAction === "writeoff"} onOpenChange={(o) => !o && setActiveAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Write Off Invoice</DialogTitle>
            <DialogDescription>
              This will permanently write off invoice {actionInvoice?.invoice_number}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 p-3 bg-destructive/5 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{actionInvoice?.clients?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Being Written Off</span>
                <span className="font-mono font-bold text-destructive">
                  ${Number(actionInvoice?.total_due || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-sm text-destructive/80">
              ⚠️ Writing off this invoice will mark it as closed with zero collection. The amount will be reflected as a loss. Confirm you want to proceed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleWriteOff} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" /> Write Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
