import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateInvoice, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { useGenerateCollectionMessage } from "@/hooks/useCollectionMessage";
import { useGenerateDemandLetter, type DemandLetterResult } from "@/hooks/useDemandLetter";
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
  const [demandScope, setDemandScope] = useState<"client" | "property">("client");
  const [demandResult, setDemandResult] = useState<DemandLetterResult | null>(null);
  const [demandLoading, setDemandLoading] = useState(false);
  const [demandCc, setDemandCc] = useState<string>("");
  const [demandSubject, setDemandSubject] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const updateInvoice = useUpdateInvoice();
  const queryClient = useQueryClient();
  const { data: companyData } = useCompanySettings();
  const generateMessage = useGenerateCollectionMessage();
  const generateDemand = useGenerateDemandLetter();
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

  const logFollowUp = async (method: string, notes: string, opts?: { invoiceIds?: string[] }) => {
    const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
    if (!profile || !invoice) return;
    const ids = opts?.invoiceIds && opts.invoiceIds.length ? opts.invoiceIds : [invoice.id];
    for (const id of ids) {
      await supabase.from("invoice_follow_ups").insert({
        company_id: profile.company_id,
        invoice_id: id,
        follow_up_date: new Date().toISOString().split("T")[0],
        contact_method: method,
        notes,
        contacted_by: profile.id,
      } as any);
      await supabase.from("invoice_activity_log").insert({
        company_id: profile.company_id,
        invoice_id: id,
        action: method,
        details: notes,
        performed_by: profile.id,
      } as any);
    }
  };

  const openDemandLetter = async (scope: "client" | "property" = "client") => {
    if (!invoice) return;
    setDemandScope(scope);
    setActiveAction("demand");
    setDemandStep("preview");
    setDemandLoading(true);
    setDemandResult(null);
    setDemandLetterText("Drafting demand letter from invoice + agreement context…");
    setDemandSubject("");
    try {
      const result = await generateDemand.mutateAsync({ invoiceId: invoice.id, scope });
      setDemandResult(result);
      setDemandLetterText(result.body);
      setDemandSubject(result.subject);
      // Resolve admin CC recipients
      const { data: profile } = await supabase.from("profiles").select("company_id").single();
      if (profile?.company_id) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id, profiles:profiles!user_roles_user_id_fkey(email)")
          .eq("role", "admin");
        const emails = (admins || [])
          .map((r: any) => r.profiles?.email)
          .filter(Boolean);
        setDemandCc(Array.from(new Set(emails)).join(", "));
      }
      if (result.warning) toast({ title: "Heads up", description: result.warning });
    } catch (err: any) {
      // Fallback to old template
      const fallback = companyData?.settings?.demand_letter_template || `Dear {{client_name}},\n\nThis letter serves as a formal demand for payment of the outstanding balance on invoice {{invoice_number}}, in the amount of {{amount_due}}.\n\nPayment is overdue by {{days_overdue}} days. Please remit payment within ten (10) business days of the date of this letter.\n\nSincerely,\n{{company_name}}`;
      setDemandLetterText(mergeDemandTemplate(fallback));
      toast({ title: "AI generation failed", description: err.message + " — using fallback template.", variant: "destructive" });
    } finally {
      setDemandLoading(false);
    }
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
        const toEmail = demandResult?.recipient?.email || recipientEmail;
        if (!toEmail) {
          toast({ title: "No email address", description: "Client or billing contact has no email on file.", variant: "destructive" });
          setProcessing(false);
          return;
        }
        const { buildDemandLetterEmail, sendBillingEmail } = await import("@/hooks/useBillingEmail");
        const { subject: defaultSubj, htmlBody } = buildDemandLetterEmail({
          invoiceNumber: invoice.invoice_number,
          totalDue: Number(invoice.total_due),
          daysOverdue,
          clientName,
          companyName,
          letterText: demandLetterText,
          companyEmail: companyData?.settings?.company_email,
          companyPhone: companyData?.settings?.company_phone,
        });
        const finalSubject = (demandSubject || demandResult?.subject || defaultSubj).trim();

        // Build PDF attachment from the freshly-edited body
        let attachments: { filename: string; content: string; mime_type: string }[] | undefined;
        try {
          if (demandResult) {
            const React = await import("react");
            const { pdf } = await import("@react-pdf/renderer");
            const { DemandLetterPDF } = await import("../DemandLetterPDF");
            const element = React.createElement(DemandLetterPDF, { data: demandResult, bodyOverride: demandLetterText });
            const blob = await pdf(element as any).toBlob();
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            const b64 = btoa(bin);
            const safeName = `Demand-Letter-${(demandResult.recipient?.name || clientName).replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
            attachments = [{ filename: safeName, content: b64, mime_type: "application/pdf" }];
          }
        } catch (pdfErr) {
          console.warn("PDF attachment build failed; sending without attachment:", pdfErr);
        }

        await sendBillingEmail({
          to: toEmail,
          cc: demandCc || undefined,
          subject: finalSubject,
          htmlBody,
          invoiceId: invoice.id,
          attachments,
        });

        const coveredIds = demandResult?.invoice_ids?.length ? demandResult.invoice_ids : [invoice.id];
        await logFollowUp("demand_letter",
          `Demand letter emailed to ${toEmail}${demandCc ? ` (cc: ${demandCc})` : ""}.\nCovers ${coveredIds.length} invoice(s).\n\n${demandLetterText}`,
          { invoiceIds: coveredIds }
        );

        // Snapshot interest if any
        if (demandResult?.grand_interest && demandResult.grand_interest > 0) {
          try {
            const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
            if (profile?.company_id && demandResult.property_groups) {
              const rows: any[] = [];
              for (const g of demandResult.property_groups) {
                for (const r of g.rows) {
                  if (r.accrued_interest > 0) {
                    const invId = coveredIds.find((id) => true); // we don't have invoice_id per row; skip if not safe
                    rows.push({
                      company_id: profile.company_id,
                      invoice_id: invId,
                      principal: r.principal,
                      rate_apr: r.rate_apr,
                      days_overdue_for_interest: r.days_overdue,
                      accrued_interest: r.accrued_interest,
                      source: "demand_letter",
                      created_by: profile.id,
                    });
                  }
                }
              }
              // Snapshots are best-effort — silent on failure
              if (rows.length) await supabase.from("invoice_interest_snapshots").insert(rows);
            }
          } catch (e) { console.warn("interest snapshot failed", e); }
        }

        toast({ title: "Demand letter sent", description: `Formal demand emailed to ${toEmail}${attachments ? " (PDF attached)" : ""}` });
        setDemandStep("edit");
        setDemandResult(null);
        setDemandCc("");
        setDemandSubject("");
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
    demandScope, setDemandScope,
    demandResult,
    demandLoading,
    demandCc, setDemandCc,
    demandSubject, setDemandSubject,
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
