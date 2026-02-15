import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle, AlertOctagon, Clock, Mail, FileWarning, Trash2, Loader2,
  CheckCircle, StickyNote, Plus, Brain, Sparkles, HandCoins, ShieldAlert,
  TrendingUp, ToggleLeft, ToggleRight, Calendar, DollarSign, SplitSquareVertical,
  Gavel, MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { differenceInDays, format } from "date-fns";
import { useUpdateInvoice, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePaymentPrediction } from "@/hooks/usePaymentPredictions";
import { usePaymentPromises, useCreatePaymentPromise } from "@/hooks/usePaymentPromises";
import { useGenerateCollectionMessage } from "@/hooks/useCollectionMessage";
import { useClientPaymentAnalytics } from "@/hooks/useClientAnalytics";
import { useExtractTasks } from "@/hooks/useExtractTasks";
import { PaymentPlanDialog } from "./PaymentPlanDialog";
import { ClaimFlowDialog } from "./ClaimFlowDialog";

interface CollectionsViewProps {
  invoices: InvoiceWithRelations[];
  onViewInvoice: (invoice: InvoiceWithRelations) => void;
  onSendReminder?: (invoice: InvoiceWithRelations) => void;
}

interface GroupedInvoice extends InvoiceWithRelations {
  daysOverdue: number;
}

type UrgencyLevel = "critical" | "urgent" | "attention";
type ViewMode = "urgency" | "ai_priority";
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

function RiskBadge({ invoiceId }: { invoiceId: string }) {
  const { data: prediction } = usePaymentPrediction(invoiceId);
  if (!prediction) return null;
  const score = prediction.risk_score;
  const color = score >= 80 ? "text-destructive bg-destructive/10 border-destructive/30"
    : score >= 60 ? "text-warning bg-warning/10 border-warning/30"
    : score >= 40 ? "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800"
    : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800";
  return (
    <Badge variant="outline" className={`text-[10px] tabular-nums ${color}`}>
      <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
      Risk {score}
    </Badge>
  );
}

function PromiseBadge({ invoiceId }: { invoiceId: string }) {
  const { data: promises } = usePaymentPromises(invoiceId);
  if (!promises || promises.length === 0) return null;
  const latest = promises[0];
  if (latest.status === "broken") {
    return (
      <Badge variant="outline" className="text-[10px] text-destructive bg-destructive/10 border-destructive/30">
        <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
        Broken Promise
      </Badge>
    );
  }
  if (latest.status === "pending") {
    const isPast = new Date(latest.promised_date) < new Date();
    return (
      <Badge variant="outline" className={`text-[10px] ${isPast ? "text-destructive bg-destructive/10 border-destructive/30" : "text-primary bg-primary/10 border-primary/30"}`}>
        <HandCoins className="h-2.5 w-2.5 mr-0.5" />
        Promise: {format(new Date(latest.promised_date), "MMM d")}
      </Badge>
    );
  }
  return null;
}

function PredictionInfo({ invoiceId }: { invoiceId: string }) {
  const { data: prediction } = usePaymentPrediction(invoiceId);
  if (!prediction) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      Est. pay: {prediction.predicted_payment_date ? format(new Date(prediction.predicted_payment_date), "MMM d") : "—"}
    </span>
  );
}

function ClientValueInfo({ clientId }: { clientId: string | undefined }) {
  const { data: analytics } = useClientPaymentAnalytics(clientId);
  if (!analytics) return null;
  const reliability = analytics.payment_reliability_score;
  const ltv = analytics.total_lifetime_value || 0;
  const reliabilityColor = reliability != null
    ? reliability >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : reliability >= 50 ? "text-amber-600 dark:text-amber-400"
    : "text-destructive"
    : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      {reliability != null && (
        <span className={reliabilityColor}>
          Reliability: {reliability}/100
        </span>
      )}
      {ltv > 0 && (
        <span>LTV: ${ltv.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
      )}
      {analytics.avg_days_to_payment != null && (
        <span>Avg Pay: {analytics.avg_days_to_payment}d</span>
      )}
    </div>
  );
}

function InvoiceCard({
  inv,
  level,
  onViewInvoice,
  onOpenNote,
  onOpenAction,
  onOpenPromise,
  onOpenPaymentPlan,
  onOpenClaimFlow,
  showAiInfo,
}: {
  inv: GroupedInvoice;
  level: UrgencyLevel;
  onViewInvoice: (inv: InvoiceWithRelations) => void;
  onOpenNote: (inv: GroupedInvoice) => void;
  onOpenAction: (action: WorkflowAction, inv: GroupedInvoice) => void;
  onOpenPromise: (inv: GroupedInvoice) => void;
  onOpenPaymentPlan: (inv: GroupedInvoice) => void;
  onOpenClaimFlow: (inv: GroupedInvoice) => void;
  showAiInfo: boolean;
}) {
  return (
    <div
      key={inv.id}
      className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onViewInvoice(inv)}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{inv.invoice_number}</span>
            <InvoiceStatusBadge status={inv.status} />
            <Badge variant="secondary" className="text-[10px]">
              {inv.daysOverdue} days
            </Badge>
            {showAiInfo && <RiskBadge invoiceId={inv.id} />}
            <PromiseBadge invoiceId={inv.id} />
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {inv.clients?.name || "Unknown client"}
            {inv.projects?.name ? ` • ${inv.projects.name}` : ""}
          </p>
          {showAiInfo && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              <PredictionInfo invoiceId={inv.id} />
              <ClientValueInfo clientId={inv.client_id || undefined} />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums font-medium text-sm">
          ${Number(inv.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => onOpenNote(inv)}
            title="Add Note"
          >
            <StickyNote className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => onOpenAction("reminder", inv)}
            title="Send Reminder"
          >
            <Mail className="h-3.5 w-3.5" />
          </Button>
          {(level === "critical" || level === "urgent" || level === "attention") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8" title="More actions">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onOpenPaymentPlan(inv)}>
                  <SplitSquareVertical className="h-3.5 w-3.5 mr-2" />
                  Payment Plan
                </DropdownMenuItem>
                {(level === "critical" || level === "urgent") && (
                  <DropdownMenuItem onClick={() => onOpenAction("demand", inv)}>
                    <FileWarning className="h-3.5 w-3.5 mr-2" />
                    Demand Letter
                  </DropdownMenuItem>
                )}
                {(level === "critical" || level === "urgent") && (
                  <DropdownMenuItem onClick={() => onOpenClaimFlow(inv)}>
                    <Gavel className="h-3.5 w-3.5 mr-2" />
                    ClaimCurrent
                  </DropdownMenuItem>
                )}
                {level === "critical" && (
                  <DropdownMenuItem onClick={() => onOpenAction("writeoff", inv)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Write Off
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

export function CollectionsView({ invoices, onViewInvoice, onSendReminder }: CollectionsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("urgency");
  const [activeAction, setActiveAction] = useState<WorkflowAction>(null);
  const [actionInvoice, setActionInvoice] = useState<GroupedInvoice | null>(null);
  const [reminderNote, setReminderNote] = useState("");
  const [demandNote, setDemandNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [quickNoteInvoice, setQuickNoteInvoice] = useState<GroupedInvoice | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [quickNoteMethod, setQuickNoteMethod] = useState("phone_call");
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  // Promise dialog
  const [promiseInvoice, setPromiseInvoice] = useState<GroupedInvoice | null>(null);
  // Payment plan dialog
  const [paymentPlanInvoice, setPaymentPlanInvoice] = useState<GroupedInvoice | null>(null);
  // ClaimFlow dialog
  const [claimFlowInvoice, setClaimFlowInvoice] = useState<GroupedInvoice | null>(null);
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseMethod, setPromiseMethod] = useState("check");
  const [promiseSource, setPromiseSource] = useState("phone_call");
  const [promiseNotes, setPromiseNotes] = useState("");
  // AI message
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ subject: string; body: string } | null>(null);
  const updateInvoice = useUpdateInvoice();
  const queryClient = useQueryClient();
  const createPromise = useCreatePaymentPromise();
  const generateMessage = useGenerateCollectionMessage();
  const extractTasks = useExtractTasks();
  const allOverdue = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((inv) => inv.status === "overdue" || inv.status === "sent")
      .map((inv) => ({
        ...inv,
        daysOverdue: inv.due_date
          ? Math.max(0, differenceInDays(now, new Date(inv.due_date)))
          : differenceInDays(now, new Date(inv.created_at)),
      }))
      .filter((inv) => inv.daysOverdue >= 30)
      .sort((a, b) => b.daysOverdue - a.daysOverdue) as GroupedInvoice[];
  }, [invoices]);

  const grouped = useMemo(() => ({
    critical: allOverdue.filter((i) => i.daysOverdue >= 90),
    urgent: allOverdue.filter((i) => i.daysOverdue >= 60 && i.daysOverdue < 90),
    attention: allOverdue.filter((i) => i.daysOverdue >= 30 && i.daysOverdue < 60),
  }), [allOverdue]);

  const totalAmount = useMemo(() => {
    return allOverdue.reduce((sum, inv) => sum + Number(inv.total_due), 0);
  }, [allOverdue]);

  const totalCount = allOverdue.length;

  const getUrgencyLevel = (daysOverdue: number): UrgencyLevel => {
    if (daysOverdue >= 90) return "critical";
    if (daysOverdue >= 60) return "urgent";
    return "attention";
  };

  const openAction = (action: WorkflowAction, inv: GroupedInvoice) => {
    setActionInvoice(inv);
    setActiveAction(action);
    setReminderNote("");
    setDemandNote("");
    setAiMessage(null);
  };

  const openPromise = (inv: GroupedInvoice) => {
    setPromiseInvoice(inv);
    setPromiseAmount(String(inv.total_due));
    setPromiseDate("");
    setPromiseMethod("check");
    setPromiseSource("phone_call");
    setPromiseNotes("");
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

  const handleQuickNote = async () => {
    if (!quickNoteInvoice || !quickNoteText.trim()) return;
    setSavingQuickNote(true);
    try {
      await logFollowUp(quickNoteInvoice.id, quickNoteMethod, quickNoteText.trim());
      queryClient.invalidateQueries({ queryKey: ["invoice-follow-ups", quickNoteInvoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-activity-log", quickNoteInvoice.id] });
      toast({ title: "Note added", description: `Note logged for ${quickNoteInvoice.invoice_number}` });

      // Fire AI task extraction in the background
      const noteInv = quickNoteInvoice;
      const noteText = quickNoteText.trim();
      setQuickNoteInvoice(null);
      setQuickNoteText("");

      extractTasks.mutate(
        {
          note_text: noteText,
          invoice_id: noteInv.id,
          client_name: noteInv.clients?.name || undefined,
          invoice_number: noteInv.invoice_number,
          days_overdue: noteInv.daysOverdue,
          amount_due: Number(noteInv.total_due),
        },
        {
          onSuccess: (result) => {
            if (result.tasks.length > 0) {
              toast({
                title: `✨ ${result.tasks.length} task${result.tasks.length > 1 ? "s" : ""} extracted`,
                description: result.tasks.map((t) => t.title).join(" · "),
              });
            }
            if (result.promises.length > 0) {
              toast({
                title: `🤝 ${result.promises.length} promise${result.promises.length > 1 ? "s" : ""} detected`,
                description: result.promises.map((p) => p.summary).join(" · "),
              });
            }
          },
          onError: () => {
            // Silently fail — note was already saved successfully
          },
        }
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingQuickNote(false);
    }
  };

  const handleSavePromise = async () => {
    if (!promiseInvoice || !promiseDate || !promiseAmount) return;
    try {
      await createPromise.mutateAsync({
        invoice_id: promiseInvoice.id,
        client_id: promiseInvoice.client_id,
        promised_amount: parseFloat(promiseAmount),
        promised_date: promiseDate,
        payment_method: promiseMethod,
        source: promiseSource,
        notes: promiseNotes,
      });
      await logFollowUp(promiseInvoice.id, promiseSource, `Promise to pay $${parseFloat(promiseAmount).toLocaleString()} by ${promiseDate} via ${promiseMethod}. ${promiseNotes}`);
      queryClient.invalidateQueries({ queryKey: ["invoice-follow-ups", promiseInvoice.id] });
      toast({ title: "Promise logged", description: `Payment promise recorded for ${promiseInvoice.invoice_number}` });
      setPromiseInvoice(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleGenerateAI = async () => {
    if (!actionInvoice) return;
    setAiGenerating(true);
    try {
      const urgency = actionInvoice.daysOverdue >= 90 ? "high" : actionInvoice.daysOverdue >= 60 ? "medium" : "low";
      const result = await generateMessage.mutateAsync({
        invoiceId: actionInvoice.id,
        companyId: actionInvoice.company_id,
        tone: "professional",
        urgency,
      });
      setAiMessage(result);
      setReminderNote(result.body);
    } catch (err: any) {
      toast({ title: "AI Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSendReminder = async () => {
    if (!actionInvoice) return;
    setProcessing(true);
    try {
      const recipientEmail = actionInvoice.billed_to_contact?.email || actionInvoice.clients?.email;
      if (!recipientEmail) {
        toast({ title: "No email address", description: "Client or billing contact has no email on file.", variant: "destructive" });
        setProcessing(false);
        return;
      }
      const { buildReminderEmail, sendBillingEmail } = await import("@/hooks/useBillingEmail");
      const { subject, htmlBody } = buildReminderEmail({
        invoiceNumber: actionInvoice.invoice_number,
        totalDue: Number(actionInvoice.total_due),
        daysOverdue: actionInvoice.daysOverdue,
        clientName: actionInvoice.clients?.name || "Client",
        companyName: "Green Light Expediting",
        customMessage: reminderNote || undefined,
      });
      await sendBillingEmail({ to: recipientEmail, subject, htmlBody });
      await logFollowUp(actionInvoice.id, "reminder_email", `Payment reminder emailed to ${recipientEmail}. ${reminderNote}`);
      toast({ title: "Payment reminder sent", description: `Reminder emailed to ${recipientEmail}` });
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
      const recipientEmail = actionInvoice.billed_to_contact?.email || actionInvoice.clients?.email;
      if (!recipientEmail) {
        toast({ title: "No email address", description: "Client or billing contact has no email on file.", variant: "destructive" });
        setProcessing(false);
        return;
      }
      const { buildDemandLetterEmail, sendBillingEmail } = await import("@/hooks/useBillingEmail");
      const { subject, htmlBody } = buildDemandLetterEmail({
        invoiceNumber: actionInvoice.invoice_number,
        totalDue: Number(actionInvoice.total_due),
        daysOverdue: actionInvoice.daysOverdue,
        clientName: actionInvoice.clients?.name || "Client",
        companyName: "Green Light Expediting",
        letterText: demandNote,
      });
      await sendBillingEmail({ to: recipientEmail, subject, htmlBody });
      await logFollowUp(actionInvoice.id, "demand_letter", `Demand letter emailed to ${recipientEmail}. ${demandNote}`);
      toast({ title: "Demand letter sent", description: `Formal demand emailed to ${recipientEmail}` });
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
          <p className="text-2xl font-bold tabular-nums mt-0.5">
            ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex items-center gap-6">
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
          <Separator orientation="vertical" className="h-10" />
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "urgency" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setViewMode("urgency")}
            >
              <Clock className="h-3.5 w-3.5 mr-1" />
              Urgency
            </Button>
            <Button
              variant={viewMode === "ai_priority" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setViewMode("ai_priority")}
            >
              <Brain className="h-3.5 w-3.5 mr-1" />
              AI Priority
            </Button>
          </div>
        </div>
      </div>

      {/* View: Urgency Groups */}
      {viewMode === "urgency" && (
        <>
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
                      <InvoiceCard
                        key={inv.id}
                        inv={inv}
                        level={level}
                        onViewInvoice={onViewInvoice}
                        onOpenNote={(inv) => { setQuickNoteInvoice(inv); setQuickNoteText(""); setQuickNoteMethod("phone_call"); }}
                        onOpenAction={openAction}
                        onOpenPromise={openPromise}
                        onOpenPaymentPlan={(inv) => setPaymentPlanInvoice(inv)}
                        onOpenClaimFlow={(inv) => setClaimFlowInvoice(inv)}
                        showAiInfo={true}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* View: AI Priority - sorted by risk score */}
      {viewMode === "ai_priority" && (
        <Card>
          <CardHeader className="pb-3 bg-primary/5 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-sm font-semibold text-primary">
                    AI-Prioritized Worklist
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Sorted by risk score — highest risk first
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-primary">
                {allOverdue.length} invoice{allOverdue.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {allOverdue.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  inv={inv}
                  level={getUrgencyLevel(inv.daysOverdue)}
                  onViewInvoice={onViewInvoice}
                  onOpenNote={(inv) => { setQuickNoteInvoice(inv); setQuickNoteText(""); setQuickNoteMethod("phone_call"); }}
                  onOpenAction={openAction}
                  onOpenPromise={openPromise}
                  onOpenPaymentPlan={(inv) => setPaymentPlanInvoice(inv)}
                  onOpenClaimFlow={(inv) => setClaimFlowInvoice(inv)}
                  showAiInfo={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminder Dialog - Enhanced with AI */}
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
              <div className="flex items-center justify-between">
                <Label>Message</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleGenerateAI}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Generate with AI
                </Button>
              </div>
              {aiMessage && (
                <div className="text-xs text-muted-foreground bg-primary/5 rounded p-2 border border-primary/20">
                  <span className="font-medium">Subject: </span>{aiMessage.subject}
                </div>
              )}
              <Textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Add a personal note to the reminder..."
                rows={aiMessage ? 8 : 3}
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

      {/* Quick Note Dialog */}
      <Dialog open={!!quickNoteInvoice} onOpenChange={(o) => !o && setQuickNoteInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Follow-Up Note</DialogTitle>
            <DialogDescription>
              Log a note for invoice {quickNoteInvoice?.invoice_number} — {quickNoteInvoice?.clients?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contact Method</Label>
              <Select value={quickNoteMethod} onValueChange={setQuickNoteMethod}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone_call">Phone Call</SelectItem>
                  <SelectItem value="left_message">Left Message (LM)</SelectItem>
                  <SelectItem value="reminder_email">Email</SelectItem>
                  <SelectItem value="note">General Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                placeholder="Called AP, spoke with Jane — said check is being processed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickNoteInvoice(null)}>Cancel</Button>
            <Button onClick={handleQuickNote} disabled={savingQuickNote || !quickNoteText.trim()}>
              {savingQuickNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <StickyNote className="h-4 w-4 mr-2" /> Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promise-to-Pay Dialog */}
      <Dialog open={!!promiseInvoice} onOpenChange={(o) => !o && setPromiseInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Promise to Pay</DialogTitle>
            <DialogDescription>
              Record a payment commitment for {promiseInvoice?.invoice_number} — {promiseInvoice?.clients?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Promised Amount</Label>
                <Input
                  type="number"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Promise Date</Label>
                <Input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select value={promiseMethod} onValueChange={setPromiseMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source</Label>
                <Select value={promiseSource} onValueChange={setPromiseSource}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={promiseNotes}
                onChange={(e) => setPromiseNotes(e.target.value)}
                placeholder="Who committed, any conditions..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromiseInvoice(null)}>Cancel</Button>
            <Button onClick={handleSavePromise} disabled={createPromise.isPending || !promiseDate}>
              {createPromise.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <HandCoins className="h-4 w-4 mr-2" /> Save Promise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Payment Plan Dialog */}
      {paymentPlanInvoice && (
        <PaymentPlanDialog
          open={!!paymentPlanInvoice}
          onOpenChange={(o) => !o && setPaymentPlanInvoice(null)}
          invoiceId={paymentPlanInvoice.id}
          invoiceNumber={paymentPlanInvoice.invoice_number}
          totalDue={Number(paymentPlanInvoice.total_due)}
          clientId={paymentPlanInvoice.client_id}
          clientName={paymentPlanInvoice.clients?.name}
        />
      )}
      {/* ClaimCurrent Dialog */}
      {claimFlowInvoice && (
        <ClaimFlowDialog
          open={!!claimFlowInvoice}
          onOpenChange={(o) => !o && setClaimFlowInvoice(null)}
          invoiceId={claimFlowInvoice.id}
          invoiceNumber={claimFlowInvoice.invoice_number}
          totalDue={Number(claimFlowInvoice.total_due)}
          dueDate={claimFlowInvoice.due_date}
          clientId={claimFlowInvoice.client_id}
          clientName={claimFlowInvoice.clients?.name}
        />
      )}
    </div>
  );
}
