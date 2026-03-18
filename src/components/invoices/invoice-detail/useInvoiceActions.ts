import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateInvoice, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { useGenerateCollectionMessage } from "@/hooks/useCollectionMessage";
import { useExtractTasks } from "@/hooks/useExtractTasks";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "@/hooks/use-toast";
import { differenceInDays, format } from "date-fns";

export type WorkflowAction = null | "reminder" | "demand" | "writeoff";

export function useInvoiceActions(invoice: InvoiceWithRelations | null) {
  const [activeAction, setActiveAction] = useState<WorkflowAction>(null);
  const [actionNote, setActionNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [demandStep, setDemandStep] = useState<"edit" | "preview">("edit");
  const [demandLetterText, setDemandLetterText] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const updateInvoice = useUpdateInvoice();
  const queryClient = useQueryClient();
  const { data: companyData } = useCompanySettings();
  const generateMessage = useGenerateCollectionMessage();
  const extractTasks = useExtractTasks();

  const daysOverdue = invoice?.due_date
    ? Math.max(0, differenceInDays(new Date(), new Date(invoice.due_date)))
    : 0;

  const mergeDemandTemplate = (template: string) => {
    if (!invoice) return template;
    return template
      .replace(/\{\{client_name\}\}/g, invoice.clients?.name || "Client")
      .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
      .replace(/\{\{invoice_date\}\}/g, invoice.created_at ? format(new Date(invoice.created_at), "MMMM d, yyyy") : "—")
      .replace(/\{\{amount_due\}\}/g, `$${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}`)
      .replace(/\{\{due_date\}\}/g, invoice.due_date ? format(new Date(invoice.due_date), "MMMM d, yyyy") : "—")
      .replace(/\{\{days_overdue\}\}/g, String(daysOverdue))
      .replace(/\{\{company_name\}\}/g, "Your Company")
      .replace(/\{\{project_name\}\}/g, invoice.projects?.name || "—");
  };

  const logFollowUp = async (method: string, notes: string) => {
    const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
    if (!profile || !invoice) return;
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

  const openDemandLetter = () => {
    const defaultTemplate = `Dear {{client_name}},\n\nThis letter serves as a formal demand for payment of the outstanding balance on invoice {{invoice_number}}, dated {{invoice_date}}, in the amount of {{amount_due}}.\n\nPayment was due on {{due_date}} and is now {{days_overdue}} days past due.\n\nDespite previous reminders, we have not received payment or a response regarding this matter. We respectfully request that full payment be remitted within ten (10) business days of the date of this letter.\n\nFailure to remit payment may result in further collection action, including but not limited to referral to a collections agency or legal proceedings.\n\nSincerely,\nYour Company`;
    const template = companyData?.settings?.demand_letter_template || defaultTemplate;
    setDemandLetterText(mergeDemandTemplate(template));
    setDemandStep("preview");
    setActiveAction("demand");
  };

  const handleAction = async () => {
    if (!activeAction || !invoice) return;
    setProcessing(true);
    try {
      const recipientEmail = invoice.billed_to_contact?.email || invoice.clients?.email;
      const clientName = invoice.clients?.name || "Client";
      const companyName = "Green Light Expediting";

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

  const handleAddNote = async (noteText: string, method: string) => {
    if (!invoice) return;
    await logFollowUp(method, noteText);
    queryClient.invalidateQueries({ queryKey: ["invoice-follow-ups", invoice.id] });
    queryClient.invalidateQueries({ queryKey: ["invoice-activity-log", invoice.id] });
    toast({ title: "Note added" });

    // AI task extraction in background
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
  };

  const generateAiMessage = async () => {
    if (!invoice) return;
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
  };

  return {
    activeAction, setActiveAction,
    actionNote, setActionNote,
    processing,
    demandStep, setDemandStep,
    demandLetterText, setDemandLetterText,
    aiGenerating,
    daysOverdue,
    updateInvoice,
    companyData,
    openDemandLetter,
    handleAction,
    handleAddNote,
    generateAiMessage,
  };
}
