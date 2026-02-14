import { useState, useMemo } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { LineItemsEditor } from "./LineItemsEditor";
import { InvoicePDFPreview } from "./InvoicePDFPreview";
import { generateInvoicePDFBlob } from "./InvoicePDFPreview";
import { useUpdateInvoice, type InvoiceWithRelations, type LineItem } from "@/hooks/useInvoices";
import { useInvoiceFollowUps, useInvoiceActivityLog } from "@/hooks/useInvoiceFollowUps";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useClientPaymentAnalytics } from "@/hooks/useClientAnalytics";
import { usePaymentPrediction } from "@/hooks/usePaymentPredictions";
import { usePaymentPromises } from "@/hooks/usePaymentPromises";
import { useGenerateCollectionMessage } from "@/hooks/useCollectionMessage";
import { useExtractTasks } from "@/hooks/useExtractTasks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import {
  Edit2, Save, X, Send, Mail, MailOpen, Clock, FileWarning, Trash2, Loader2,
  MessageSquare, Activity, Eye, Edit3, Plus, Phone, StickyNote, Download, FileText,
  ChevronDown, TrendingUp, HandCoins, ShieldAlert, Sparkles, BarChart3,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";

interface InvoiceDetailSheetProps {
  invoice: InvoiceWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendInvoice?: (invoice: InvoiceWithRelations) => void;
}

type WorkflowAction = null | "reminder" | "demand" | "writeoff";

export function InvoiceDetailSheet({ invoice, open, onOpenChange, onSendInvoice }: InvoiceDetailSheetProps) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [activeAction, setActiveAction] = useState<WorkflowAction>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [demandStep, setDemandStep] = useState<"edit" | "preview">("edit");
  const [demandLetterText, setDemandLetterText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteMethod, setNewNoteMethod] = useState("phone_call");
  const [savingNote, setSavingNote] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientEdits, setClientEdits] = useState({ name: "", email: "", phone: "", address: "" });
  const [savingClient, setSavingClient] = useState(false);
  const updateInvoice = useUpdateInvoice();
  const queryClient = useQueryClient();
  const { data: followUps } = useInvoiceFollowUps(invoice?.id);
  const { data: activityLog } = useInvoiceActivityLog(invoice?.id);
  const { data: companyData } = useCompanySettings();
  const { data: clientAnalytics } = useClientPaymentAnalytics(invoice?.client_id ?? undefined);
  const { data: prediction } = usePaymentPrediction(invoice?.id ?? undefined);
  const { data: promises } = usePaymentPromises(invoice?.id ?? undefined);
  const generateMessage = useGenerateCollectionMessage();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const extractTasks = useExtractTasks();

  if (!invoice) return null;

  const lineItems: LineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  const daysOverdue = invoice.due_date
    ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
    : 0;

  const mergeDemandTemplate = (template: string) => {
    return template
      .replace(/\{\{client_name\}\}/g, invoice.clients?.name || "Client")
      .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
      .replace(/\{\{invoice_date\}\}/g, invoice.created_at ? format(new Date(invoice.created_at), "MMMM d, yyyy") : "—")
      .replace(/\{\{amount_due\}\}/g, `$${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}`)
      .replace(/\{\{due_date\}\}/g, invoice.due_date ? format(new Date(invoice.due_date), "MMMM d, yyyy") : "—")
      .replace(/\{\{days_overdue\}\}/g, String(daysOverdue))
      .replace(/\{\{company_name\}\}/g, companyData?.settings?.default_terms ? "Your Company" : "Your Company")
      .replace(/\{\{project_name\}\}/g, invoice.projects?.name || "—");
  };

  const openDemandLetter = () => {
    const defaultTemplate = `Dear {{client_name}},\n\nThis letter serves as a formal demand for payment of the outstanding balance on invoice {{invoice_number}}, dated {{invoice_date}}, in the amount of {{amount_due}}.\n\nPayment was due on {{due_date}} and is now {{days_overdue}} days past due.\n\nDespite previous reminders, we have not received payment or a response regarding this matter. We respectfully request that full payment be remitted within ten (10) business days of the date of this letter.\n\nFailure to remit payment may result in further collection action, including but not limited to referral to a collections agency or legal proceedings.\n\nSincerely,\nYour Company`;
    const template = companyData?.settings?.demand_letter_template || defaultTemplate;
    setDemandLetterText(mergeDemandTemplate(template));
    setDemandStep("preview");
    setActiveAction("demand");
  };

  const startEdit = () => {
    setEditItems([...lineItems]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditItems([]);
  };

  const saveEdit = async () => {
    const subtotal = editItems.reduce((sum, i) => sum + i.amount, 0);
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        line_items: editItems,
        subtotal,
        total_due: subtotal - Number(invoice.retainer_applied || 0),
      });
      toast({ title: "Invoice updated" });
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const logFollowUp = async (method: string, notes: string) => {
    const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
    if (!profile) return;
    await supabase.from("invoice_follow_ups").insert({
      company_id: profile.company_id,
      invoice_id: invoice.id,
      follow_up_date: new Date().toISOString().split("T")[0],
      contact_method: method,
      notes,
      contacted_by: profile.id,
    } as any);
    await supabase.from("invoice_activity_log").insert({
      company_id: profile.company_id,
      invoice_id: invoice.id,
      action: method,
      details: notes,
      performed_by: profile.id,
    } as any);
  };


  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const noteText = newNoteText.trim();
      await logFollowUp(newNoteMethod, noteText);
      queryClient.invalidateQueries({ queryKey: ["invoice-follow-ups", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-activity-log", invoice.id] });
      toast({ title: "Note added" });
      setNewNoteText("");
      setAddingNote(false);

      // AI task extraction in background
      const daysOverdue = invoice.due_date
        ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
        : 0;
      extractTasks.mutate(
        {
          note_text: noteText,
          invoice_id: invoice.id,
          client_name: invoice.clients?.name || undefined,
          invoice_number: invoice.invoice_number,
          days_overdue: daysOverdue,
          amount_due: Number(invoice.total_due),
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
        }
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveClient = async () => {
    if (!invoice.client_id) return;
    setSavingClient(true);
    try {
      const updates: Record<string, string> = {};
      if (clientEdits.name.trim()) updates.name = clientEdits.name.trim();
      if (clientEdits.email !== (invoice.clients?.email || "")) updates.email = clientEdits.email.trim() || null as any;
      if (clientEdits.phone !== (invoice.clients?.phone || "")) updates.phone = clientEdits.phone.trim() || null as any;
      if (clientEdits.address !== (invoice.clients?.address || "")) updates.address = clientEdits.address.trim() || null as any;

      const { error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", invoice.client_id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Client info updated" });
      setEditingClient(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingClient(false);
    }
  };

  const handleAction = async () => {
    if (!activeAction) return;
    setProcessing(true);
    try {
      const recipientEmail = invoice.billed_to_contact?.email || invoice.clients?.email;
      const clientName = invoice.clients?.name || "Client";
      const companyName = companyData?.settings?.company_email ? "Green Light Expediting" : "Green Light Expediting";

      if (activeAction === "reminder") {
        if (!recipientEmail) {
          toast({ title: "No email address", description: "Client or billing contact has no email on file.", variant: "destructive" });
          setProcessing(false);
          return;
        }
        const { buildReminderEmail, sendBillingEmail } = await import("@/hooks/useBillingEmail");
        const { subject, htmlBody } = buildReminderEmail({
          invoiceNumber: invoice.invoice_number,
          totalDue: Number(invoice.total_due),
          daysOverdue,
          clientName,
          companyName,
          customMessage: actionNote || undefined,
          companyEmail: companyData?.settings?.company_email,
          companyPhone: companyData?.settings?.company_phone,
        });
        await sendBillingEmail({ to: recipientEmail, subject, htmlBody });
        await logFollowUp("reminder_email", `Payment reminder sent to ${recipientEmail}. ${actionNote}`);
        toast({ title: "Payment reminder sent", description: `Reminder emailed to ${recipientEmail}` });
      } else if (activeAction === "demand") {
        if (!recipientEmail) {
          toast({ title: "No email address", description: "Client or billing contact has no email on file.", variant: "destructive" });
          setProcessing(false);
          return;
        }
        const { buildDemandLetterEmail, sendBillingEmail } = await import("@/hooks/useBillingEmail");
        const { subject, htmlBody } = buildDemandLetterEmail({
          invoiceNumber: invoice.invoice_number,
          totalDue: Number(invoice.total_due),
          daysOverdue,
          clientName,
          companyName,
          letterText: demandLetterText,
          companyEmail: companyData?.settings?.company_email,
          companyPhone: companyData?.settings?.company_phone,
        });
        await sendBillingEmail({ to: recipientEmail, subject, htmlBody });
        await logFollowUp("demand_letter", `Demand letter emailed to ${recipientEmail}.\n\n${demandLetterText}`);
        toast({ title: "Demand letter sent", description: `Formal demand emailed to ${recipientEmail}` });
        setDemandStep("edit");
      } else if (activeAction === "writeoff") {
        await updateInvoice.mutateAsync({ id: invoice.id, status: "paid" } as any);
        await logFollowUp("write_off", `Invoice written off. Amount: $${Number(invoice.total_due).toFixed(2)}`);
        toast({ title: "Invoice written off", description: `${invoice.invoice_number} marked as written off` });
      }
      setActiveAction(null);
      setActionNote("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const pmName = invoice.created_by_profile
    ? `${invoice.created_by_profile.first_name || ""} ${invoice.created_by_profile.last_name || ""}`.trim()
    : "—";

  const isOverdue = invoice.status === "overdue";
  const isSent = invoice.status === "sent";

  const actionDialogConfig = {
    reminder: {
      title: "Send Payment Reminder",
      description: `Send a reminder for invoice ${invoice.invoice_number}`,
      buttonLabel: "Send Reminder",
      buttonIcon: <Mail className="h-4 w-4 mr-2" />,
      variant: "default" as const,
      placeholder: "Add a personal note to the reminder...",
    },
    demand: {
      title: "Send Demand Letter",
      description: `Send a formal demand letter for invoice ${invoice.invoice_number}. This is a serious escalation.`,
      buttonLabel: "Send Demand Letter",
      buttonIcon: <FileWarning className="h-4 w-4 mr-2" />,
      variant: "destructive" as const,
      placeholder: "Reference contract terms, prior communications, etc.",
    },
    writeoff: {
      title: "Write Off Invoice",
      description: `Permanently write off invoice ${invoice.invoice_number} ($${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}). This cannot be undone.`,
      buttonLabel: "Write Off",
      buttonIcon: <Trash2 className="h-4 w-4 mr-2" />,
      variant: "destructive" as const,
      placeholder: "",
    },
  };

  const methodLabels: Record<string, string> = {
    reminder_email: "Reminder Sent",
    demand_letter: "Demand Letter",
    write_off: "Written Off",
    phone_call: "Phone Call",
    left_message: "Left Message",
    note: "Note",
    created: "Created",
    sent: "Sent",
    paid: "Paid",
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-1 pr-8">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-lg tracking-tight">
                {invoice.invoice_number}
              </SheetTitle>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Project Info */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Project</h4>
              <p className="text-sm font-medium">
                {invoice.projects
                  ? `${invoice.projects.project_number || ""} - ${invoice.projects.name || "Untitled"}`
                  : "No project linked"}
              </p>
              <p className="text-sm text-muted-foreground">
                Client: {invoice.clients?.name || "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                Created by: {pmName} • {invoice.created_at ? format(new Date(invoice.created_at), "M/d/yyyy h:mm a") : "—"}
              </p>
            </section>

            <Separator />

            {/* Delivery Status */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Delivery Status</h4>
              {invoice.sent_at ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>Sent on {format(new Date(invoice.sent_at), "MMMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                  {invoice.paid_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <MailOpen className="h-4 w-4 text-success" />
                      <span>Paid on {format(new Date(invoice.paid_at), "MMMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                  )}
                  {isOverdue && invoice.due_date && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <Clock className="h-4 w-4" />
                      <span>
                        Overdue since {format(new Date(invoice.due_date), "MMMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not yet sent</p>
              )}
            </section>

            <Separator />

            {/* Client & Billing Contact */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Client Info</h4>
                {!editingClient && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditingClient(true);
                    setClientEdits({
                      name: invoice.clients?.name || "",
                      email: invoice.clients?.email || "",
                      phone: invoice.clients?.phone || "",
                      address: invoice.clients?.address || "",
                    });
                  }}>
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
              </div>

              {editingClient ? (
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={clientEdits.name}
                      onChange={(e) => setClientEdits((p) => ({ ...p, name: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={clientEdits.email}
                      onChange={(e) => setClientEdits((p) => ({ ...p, email: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={clientEdits.phone}
                      onChange={(e) => setClientEdits((p) => ({ ...p, phone: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={clientEdits.address}
                      onChange={(e) => setClientEdits((p) => ({ ...p, address: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingClient(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" disabled={savingClient} onClick={handleSaveClient}>
                      {savingClient && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium">{invoice.clients?.name || "—"}</p>
                  {invoice.clients?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <a href={`tel:${invoice.clients.phone}`} className="text-primary hover:underline">
                        {invoice.clients.phone}
                      </a>
                    </div>
                  )}
                  {invoice.clients?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <a href={`mailto:${invoice.clients.email}`} className="text-primary hover:underline">
                        {invoice.clients.email}
                      </a>
                    </div>
                  )}
                  {invoice.clients?.address && (
                    <p className="text-xs text-muted-foreground">{invoice.clients.address}</p>
                  )}
                </div>
              )}

              {/* Sent To / Billing Contact — always show */}
              <div className="mt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                  {invoice.billed_to_contact ? "Sent To (Billing Contact)" : "Sent To"}
                </h4>
                {invoice.billed_to_contact ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                    <p className="text-sm font-semibold">{invoice.billed_to_contact.name}</p>
                    {invoice.billed_to_contact.title && (
                      <p className="text-xs text-muted-foreground">{invoice.billed_to_contact.title}{invoice.billed_to_contact.company_name ? ` at ${invoice.billed_to_contact.company_name}` : ""}</p>
                    )}
                    {invoice.billed_to_contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${invoice.billed_to_contact.email}`} className="text-primary hover:underline">
                          {invoice.billed_to_contact.email}
                        </a>
                      </div>
                    )}
                    {invoice.billed_to_contact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Office</span>
                        <a href={`tel:${invoice.billed_to_contact.phone}`} className="text-primary hover:underline">
                          {invoice.billed_to_contact.phone}
                        </a>
                      </div>
                    )}
                    {invoice.billed_to_contact.mobile && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Mobile</span>
                        <a href={`tel:${invoice.billed_to_contact.mobile}`} className="text-primary hover:underline">
                          {invoice.billed_to_contact.mobile}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No billing contact assigned — sent to client directly</p>
                )}
              </div>
            </section>

            <Separator />

            {/* Client Payment Analytics — Collapsible */}
            {clientAnalytics && (
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
                        <p className="text-lg font-bold tabular-nums">
                          {clientAnalytics.payment_reliability_score != null ? `${clientAnalytics.payment_reliability_score}/100` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Avg Days to Pay</p>
                        <p className="text-lg font-bold tabular-nums">
                          {clientAnalytics.avg_days_to_payment != null ? `${clientAnalytics.avg_days_to_payment}d` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Lifetime Value</p>
                        <p className="text-lg font-bold tabular-nums">
                          ${(clientAnalytics.total_lifetime_value || 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Last 12mo</p>
                        <p className="text-sm font-medium">
                          {clientAnalytics.last_12mo_paid_on_time ?? 0} on time / {clientAnalytics.last_12mo_late ?? 0} late
                        </p>
                      </div>
                    </div>
                    {clientAnalytics.longest_days_late != null && clientAnalytics.longest_days_late > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Longest late: {clientAnalytics.longest_days_late} days • 
                        Responds to reminders: {clientAnalytics.responds_to_reminders ? "Yes" : "No"}
                      </p>
                    )}
                    {clientAnalytics.preferred_contact_method && (
                      <p className="text-xs text-muted-foreground">
                        Preferred contact: {clientAnalytics.preferred_contact_method}
                        {clientAnalytics.best_contact_time ? ` (${clientAnalytics.best_contact_time})` : ""}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* AI Risk Prediction — Collapsible */}
            {prediction && (
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
                    }`}>
                      Risk {prediction.risk_score}
                    </Badge>
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
                          <p key={key} className="text-xs text-muted-foreground">• {val}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Promises to Pay — Collapsible */}
            {promises && promises.length > 0 && (
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
                              <span className="tabular-nums font-medium text-sm">
                                ${p.promised_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              by {format(new Date(p.promised_date), "MMM d, yyyy")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            via {p.payment_method || "—"} • source: {p.source}
                          </p>
                          {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Line Items */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
                {!editing && (invoice.status === "draft" || invoice.status === "ready_to_send" || invoice.status === "needs_review") && (
                  <Button variant="ghost" size="sm" onClick={startEdit}>
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
                {editing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit} disabled={updateInvoice.isPending}>
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>
              <LineItemsEditor
                items={editing ? editItems : lineItems}
                onChange={setEditItems}
                readOnly={!editing}
              />
            </section>

            <Separator />

            {/* Totals */}
            <section className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">${Number(invoice.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {Number(invoice.retainer_applied) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Retainer Applied</span>
                  <span className="tabular-nums">-${Number(invoice.retainer_applied).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 border-t">
                <span>Total Due</span>
                <span className="tabular-nums">${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </section>

            {/* Payment Terms */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Payment Terms</h4>
              <p className="text-sm">{invoice.payment_terms || "Net 30"}</p>
              {invoice.due_date && (
                <p className="text-sm text-muted-foreground">
                  Due: {format(new Date(invoice.due_date), "MMMM d, yyyy")}
                </p>
              )}
            </section>

            {/* Special Instructions */}
            {invoice.special_instructions && (
              <>
                <Separator />
                <section>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Special Instructions</h4>
                  <p className="text-sm">{invoice.special_instructions}</p>
                </section>
              </>
            )}

            <Separator />

            {/* Follow-Up Notes */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium text-muted-foreground">Follow-Up Notes</h4>
                </div>
                {!addingNote && (
                  <Button variant="ghost" size="sm" onClick={() => setAddingNote(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Note
                  </Button>
                )}
              </div>

              {/* Inline Add Note Form */}
              {addingNote && (
                <div className="rounded-lg border p-3 mb-3 space-y-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact Method</Label>
                    <Select value={newNoteMethod} onValueChange={setNewNoteMethod}>
                      <SelectTrigger className="h-8 text-sm">
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
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Called Rudin's office, spoke to AP dept..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setAddingNote(false); setNewNoteText(""); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddNote} disabled={savingNote || !newNoteText.trim()}>
                      {savingNote && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}

              {followUps && followUps.length > 0 ? (
                <div className="space-y-2">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="rounded-md border p-2.5 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          {methodLabels[fu.contact_method || ""] || fu.contact_method}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(fu.created_at), "M/d/yyyy h:mm a")}
                        </span>
                      </div>
                      {fu.notes && <p className="text-muted-foreground">{fu.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                !addingNote && <p className="text-sm text-muted-foreground">No follow-up notes yet</p>
              )}
            </section>

            <Separator />

            {/* Activity Log */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium text-muted-foreground">Activity Log</h4>
              </div>
              {(() => {
                // Build a combined timeline: explicit log entries + synthetic entries from invoice timestamps
                const syntheticEntries: { id: string; created_at: string; action: string; details: string | null }[] = [];
                
                // Always show created
                if (invoice.created_at) {
                  syntheticEntries.push({
                    id: "syn-created",
                    created_at: invoice.created_at,
                    action: "created",
                    details: `Invoice ${invoice.invoice_number} created`,
                  });
                }
                // Show sent if sent_at exists and no explicit "sent" log entry
                if (invoice.sent_at && !(activityLog || []).some((e) => e.action === "sent")) {
                  syntheticEntries.push({
                    id: "syn-sent",
                    created_at: invoice.sent_at,
                    action: "sent",
                    details: "Invoice sent",
                  });
                }
                // Show paid if paid_at exists and no explicit "paid" log entry
                if (invoice.paid_at && !(activityLog || []).some((e) => e.action === "paid")) {
                  const paymentDetails = [
                    "Payment received",
                    invoice.payment_method ? `via ${invoice.payment_method}` : null,
                    invoice.payment_amount ? `$${Number(invoice.payment_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null,
                  ].filter(Boolean).join(" — ");
                  syntheticEntries.push({
                    id: "syn-paid",
                    created_at: invoice.paid_at,
                    action: "paid",
                    details: paymentDetails,
                  });
                }

                // Merge and deduplicate: explicit entries take precedence
                const explicitActions = new Set((activityLog || []).map((e) => e.action));
                const filtered = syntheticEntries.filter((s) => !explicitActions.has(s.action));
                const combined = [...(activityLog || []), ...filtered].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                if (combined.length === 0) {
                  return <p className="text-sm text-muted-foreground">No activity recorded</p>;
                }

                return (
                  <div className="space-y-1.5">
                    {combined.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(entry.created_at), "M/d/yy h:mm a")}
                        </span>
                        <span className="font-medium">
                          {methodLabels[entry.action] || entry.action}
                        </span>
                        {entry.details && (
                          <span className="text-muted-foreground truncate">— {entry.details}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {/* PDF Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setPdfPreviewOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" /> Preview PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      const blob = await generateInvoicePDFBlob(invoice, companyData?.settings);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${invoice.invoice_number}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err: any) {
                      toast({ title: "PDF Error", description: err.message, variant: "destructive" });
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download
                </Button>
              </div>

              {(invoice.status === "draft" || invoice.status === "ready_to_send") && onSendInvoice && (
                <Button
                  onClick={() => onSendInvoice(invoice)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Send className="h-4 w-4 mr-2" /> Send Invoice
                </Button>
              )}

              {(isOverdue || isSent) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Collections Actions</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setActiveAction("reminder"); setActionNote(""); }}
                    >
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Reminder
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={openDemandLetter}
                    >
                      <FileWarning className="h-3.5 w-3.5 mr-1.5" /> Demand Letter
                    </Button>
                  </div>
                  {isOverdue && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => { setActiveAction("writeoff"); setActionNote(""); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Write Off
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reminder / Write-Off Dialog */}
      {activeAction && activeAction !== "demand" && (
        <Dialog open={!!activeAction} onOpenChange={(o) => !o && setActiveAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={activeAction === "writeoff" ? "text-destructive" : ""}>
                {actionDialogConfig[activeAction].title}
              </DialogTitle>
              <DialogDescription>
                {actionDialogConfig[activeAction].description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="tabular-nums font-medium">
                    ${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {activeAction === "reminder" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Message</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={async () => {
                        setAiGenerating(true);
                        try {
                          const urgency = daysOverdue >= 90 ? "high" : daysOverdue >= 60 ? "medium" : "low";
                          const result = await generateMessage.mutateAsync({
                            invoiceId: invoice.id,
                            companyId: invoice.company_id,
                            tone: "professional",
                            urgency,
                          });
                          setActionNote(result.body);
                        } catch (err: any) {
                          toast({ title: "AI Generation Failed", description: err.message, variant: "destructive" });
                        } finally {
                          setAiGenerating(false);
                        }
                      }}
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
                  <Textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder={actionDialogConfig[activeAction].placeholder}
                    rows={aiGenerating ? 6 : 3}
                  />
                </div>
              )}
              {activeAction === "writeoff" && (
                <p className="text-sm text-destructive/80">
                  ⚠️ This will mark the invoice as closed with zero collection. The amount will be reflected as a loss.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
              <Button
                variant={actionDialogConfig[activeAction].variant}
                onClick={handleAction}
                disabled={processing}
              >
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {actionDialogConfig[activeAction].buttonIcon}
                {actionDialogConfig[activeAction].buttonLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Demand Letter Preview Dialog */}
      {activeAction === "demand" && (
        <Dialog open onOpenChange={(o) => { if (!o) { setActiveAction(null); setDemandStep("edit"); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                {demandStep === "preview" ? "Preview Demand Letter" : "Edit Demand Letter"}
              </DialogTitle>
              <DialogDescription>
                {demandStep === "preview"
                  ? "Review the letter below before sending. Click Edit to make changes."
                  : "Make edits to the demand letter. Click Preview when ready."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-medium">{invoice.clients?.name || "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Re: Invoice</span>
                  <span className="font-mono font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="tabular-nums font-bold text-destructive">
                    ${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Overdue</span>
                  <span className="font-bold text-destructive">{daysOverdue}</span>
                </div>
              </div>

              {demandStep === "preview" ? (
                <div className="rounded-lg border p-6 bg-background whitespace-pre-wrap text-sm leading-relaxed font-serif min-h-[200px]">
                  {demandLetterText}
                </div>
              ) : (
                <Textarea
                  value={demandLetterText}
                  onChange={(e) => setDemandLetterText(e.target.value)}
                  rows={16}
                  className="font-mono text-sm"
                />
              )}
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => { setActiveAction(null); setDemandStep("edit"); }}>
                Cancel
              </Button>
              {demandStep === "preview" ? (
                <>
                  <Button variant="outline" onClick={() => setDemandStep("edit")}>
                    <Edit3 className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" onClick={handleAction} disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <FileWarning className="h-4 w-4 mr-2" /> Send Demand Letter
                  </Button>
                </>
              ) : (
                <Button onClick={() => setDemandStep("preview")}>
                  <Eye className="h-4 w-4 mr-2" /> Preview
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <InvoicePDFPreview
        invoice={invoice}
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
      />
    </>
  );
}
