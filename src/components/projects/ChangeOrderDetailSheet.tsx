import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pdf } from "@react-pdf/renderer";
import { buildChangeOrderEmailHtml, resolveEmailStyle, resolveChangeOrderEmailTemplate } from "./buildChangeOrderEmailHtml";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PenLine, Send, CheckCheck, XCircle, ShieldCheck, AlertTriangle,
  Pencil, GitBranch, Clock, MoreVertical, FileDown, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ChangeOrder } from "@/hooks/useChangeOrders";
import { useUpdateChangeOrder, useMarkCOApproved, useSendCOToClient, useSignCOInternal, useDeleteChangeOrder } from "@/hooks/useChangeOrders";
import { COSignatureDialog } from "./COSignatureDialog";
import { ChangeOrderDialog } from "./ChangeOrderDialog";
import { ChangeOrderPDF } from "./ChangeOrderPDF";
import type { ChangeOrderFormInput } from "@/hooks/useChangeOrders";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/hooks/useAuth";
import { useChangeOrderEmails } from "@/hooks/useEmails";
import { RecordEmailsSection } from "@/components/emails/RecordEmailsSection";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "MM/dd/yyyy") : null;

const STATUS_CONFIG: Record<ChangeOrder["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-muted-foreground/40 text-muted-foreground bg-muted/30" },
  pending_internal: { label: "Pending Internal Sign", className: "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20" },
  pending_client: { label: "Pending Client", className: "border-blue-400 text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20" },
  approved: { label: "Approved", className: "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20" },
  rejected: { label: "Rejected", className: "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20" },
  voided: { label: "Voided", className: "border-muted-foreground/40 text-muted-foreground bg-muted/30 line-through" },
};

interface ChangeOrderDetailSheetProps {
  co: ChangeOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceNames?: string[];
  autoSign?: boolean;
  onAutoSignComplete?: () => void;
}

export function ChangeOrderDetailSheet({
  co,
  open,
  onOpenChange,
  serviceNames = [],
  autoSign = false,
  onAutoSignComplete,
}: ChangeOrderDetailSheetProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { data: companySettings } = useCompanySettings();
  const [signOpen, setSignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [notes, setNotes] = useState(co?.notes ?? "");
  const [sendAfterSign, setSendAfterSign] = useState(false);
  const autoSignTriggered = useRef(false);
  const autoArchiveTriggered = useRef<string | null>(null);

  // Auto-open signature dialog when autoSign prop is set
  useEffect(() => {
    if (open && autoSign && co && !autoSignTriggered.current) {
      autoSignTriggered.current = true;
      setSendAfterSign(true);
      setSignOpen(true);
    }
    if (!open) {
      autoSignTriggered.current = false;
      setSendAfterSign(false);
    }
  }, [open, autoSign, co]);

  // Auto-archive: deferred flag, checked after savePdfToDocuments is defined
  const shouldAutoArchive = useRef(false);
  useEffect(() => {
    if (co && co.internal_signed_at && co.client_signed_at && autoArchiveTriggered.current !== co.id) {
      autoArchiveTriggered.current = co.id;
      shouldAutoArchive.current = true;
    }
  }, [co?.id, co?.internal_signed_at, co?.client_signed_at]);

  const signCO = useSignCOInternal();
  const approveCO = useMarkCOApproved();
  const sendCO = useSendCOToClient();
  const updateCO = useUpdateChangeOrder();
  const deleteCO = useDeleteChangeOrder();

  // Fetch project context for PDF
  const { data: projectInfo } = useQuery({
    queryKey: ["project-co-context", co?.project_id],
    enabled: !!co?.project_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("project_number, property_id, properties(address, borough), client_id, clients!projects_client_id_fkey(name)")
        .eq("id", co!.project_id)
        .single();
      if (!data) return null;
      const props = data.properties as any;
      return {
        project_number: data.project_number,
        address: props?.address || null,
        borough: props?.borough || null,
        client_id: data.client_id,
        clients: data.clients,
      };
    },
  });

  // Fetch contract summary data for PDF (original contract + prior COs)
  const { data: contractSummary } = useQuery({
    queryKey: ["co-contract-summary", co?.project_id, co?.id],
    enabled: !!co?.project_id,
    queryFn: async () => {
      // Get original contract total from services (non-CO services)
      const { data: services } = await supabase
        .from("services")
        .select("total_amount, change_order_id")
        .eq("project_id", co!.project_id);
      const originalTotal = (services || [])
        .filter(s => !s.change_order_id)
        .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

      // Get all approved COs for this project (excluding current)
      const { data: approvedCOs } = await supabase
        .from("change_orders")
        .select("id, amount")
        .eq("project_id", co!.project_id)
        .eq("status", "approved")
        .neq("id", co!.id);
      const priorCOsTotal = (approvedCOs || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const priorCOsCount = (approvedCOs || []).length;

      return { originalTotal, priorCOsTotal, priorCOsCount };
    },
  });

  // Resolve internal signer name (must be before conditional return)
  const { data: signerProfile } = useQuery({
    queryKey: ["profile", co?.internal_signed_by],
    enabled: !!co?.internal_signed_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, first_name, last_name")
        .eq("id", co!.internal_signed_by!)
        .single();
      return data;
    },
  });

  // Resolve sent_to_email to a contact name
  const sentToEmail = (co as any)?.sent_to_email;
  const { data: sentToContact } = useQuery({
    queryKey: ["contact-by-email", sentToEmail],
    enabled: !!sentToEmail,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contacts")
        .select("name")
        .eq("email", sentToEmail)
        .limit(1)
        .maybeSingle();
      return data as { name: string } | null;
    },
  });

  const pendingSendSignatureRef = useRef<string | null>(null);

  // Deferred send handler — resolves handleSend reference issue since it's defined after early return
  const handleSendRef = useRef<((sigData: string) => void) | null>(null);

  useEffect(() => {
    if (co && pendingSendSignatureRef.current && co.internal_signed_at) {
      const sigData = pendingSendSignatureRef.current;
      pendingSendSignatureRef.current = null;
      // Defer to next tick so handleSend is available
      requestAnimationFrame(() => {
        handleSendRef.current?.(sigData);
      });
    }
  }, [co?.internal_signed_at]);

  if (!co) return null;

  const signerName = signerProfile
    ? (signerProfile as any).display_name || `${(signerProfile as any).first_name ?? ""} ${(signerProfile as any).last_name ?? ""}`.trim()
    : null;
  const sentToDisplay = sentToContact?.name
    ? `${sentToContact.name} (${sentToEmail})`
    : sentToEmail || "client";
  const statusCfg = STATUS_CONFIG[co.status] || STATUS_CONFIG.draft;
  const internalSigned = !!co.internal_signed_at;
  const clientSigned = !!co.client_signed_at;
  const fullyExecuted = internalSigned && clientSigned;
  const isDraft = co.status === "draft";
  const canEdit = isDraft || co.status === "pending_internal";
  const canSign = !internalSigned && co.status !== "voided" && co.status !== "rejected";
  const canSend = internalSigned && !co.sent_at && co.status !== "approved" && co.status !== "voided" && co.status !== "rejected";
  const canResend = internalSigned && !!co.sent_at && co.status === "pending_client" && !clientSigned;
  const canApprove = co.status === "pending_client" || co.status === "pending_internal";
  const canVoid = co.status !== "voided" && co.status !== "approved";
  const canReject = co.status !== "rejected" && co.status !== "voided" && co.status !== "approved";
  const canDelete = isDraft;

  const handleSign = async (signatureData: string) => {
    try {
      const shouldSend = sendAfterSign;
      setSendAfterSign(false);
      await signCO.mutateAsync({ id: co.id, project_id: co.project_id, signatureData });
      setSignOpen(false);
      toast({ title: `${co.co_number} signed`, description: "Status → Pending Client." });
      onAutoSignComplete?.();
      // Auto-send to client after signing — use ref to survive re-renders
      if (shouldSend) {
        pendingSendSignatureRef.current = signatureData;
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSend = async (pendingSignatureData?: string) => {
    try {
      // Look up the project's client_id first
      const { data: project } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", co.project_id)
        .single();

      const clientId = (project as any)?.client_id;
      if (!clientId) {
        toast({
          title: "No client linked",
          description: "This project has no client assigned. Link a client before sending.",
          variant: "destructive",
        });
        return;
      }

      // Find a contact with an email for that client
      const { data: contacts } = await supabase
        .from("client_contacts" as any)
        .select("email, name")
        .eq("client_id", clientId)
        .not("email", "is", null)
        .limit(1);

      let contactEmail = "";
      let contactName = "";

      if (contacts && contacts.length > 0 && (contacts[0] as any).email) {
        contactEmail = (contacts[0] as any).email;
        contactName = (contacts[0] as any).name || "";
      } else {
        // Fallback: use the client's own email
        const { data: clientData } = await supabase
          .from("clients")
          .select("name, email")
          .eq("id", clientId)
          .maybeSingle();

        if (clientData?.email) {
          contactEmail = clientData.email;
          contactName = clientData.name || "";
        } else {
          const clientName = clientData?.name || "this client";
          toast({
            title: "No client email found",
            description: `Add an email address to "${clientName}" or one of its contacts before sending.`,
            variant: "destructive",
          });
          return;
        }
      }

      // Fetch the public_token for the signing link
      const { data: coTokenData } = await (supabase as any)
        .from("change_orders")
        .select("public_token")
        .eq("id", co.id)
        .single();
      const publicToken = coTokenData?.public_token;
      const signingLink = publicToken ? `${window.location.origin}/change-order/${publicToken}` : null;

      // Generate the PDF and convert to base64 for attachment
      const pdfBlob = await generatePdfBlob(pendingSignatureData);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const pdfBase64 = btoa(binary);

      const fileName = `${co.co_number.replace("#", "")}_${co.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      const companyName = companySettings?.name || "Our Company";
      const projectAddr = projectInfo?.address || "the project";
      const settings = companySettings?.settings;
      const emailStyle = resolveEmailStyle(settings?.email_style);
      const depositPct = (co as any).deposit_percentage || 0;
      const depositAmt = depositPct > 0 ? fmt(Math.abs(co.amount) * depositPct / 100) : undefined;

      const templateOverrides = settings?.email_template_overrides?.change_order;
      const htmlBody = buildChangeOrderEmailHtml({
        contactName,
        coNumber: co.co_number,
        coTitle: co.title,
        amount: fmt(co.amount),
        description: co.description || undefined,
        signingLink,
        companyName,
        companyEmail: settings?.company_email || companySettings?.email,
        companyPhone: settings?.company_phone || companySettings?.phone,
        companyAddress: companySettings?.address || settings?.company_address,
        logoUrl: companySettings?.logo_url || settings?.company_logo_url || "",
        projectAddress: projectAddr,
        depositPercentage: depositPct,
        depositAmount: depositAmt,
        style: emailStyle,
        template: templateOverrides,
      });

      // Send the email via gmail-send edge function. Pass project_id + change_order_id
      // so the outbound email auto-tags to both — the project's Emails tab and the
      // CO detail panel both surface the thread (and any replies that arrive later).
      const { data: sendResult, error: sendError } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: contactEmail,
          subject: resolveChangeOrderEmailTemplate(templateOverrides, {
            CLIENT_NAME: contactName, COMPANY_NAME: companyName, CO_NUMBER: co.co_number,
            PROJECT_TITLE: co.title, PROPERTY_ADDRESS: projectAddr, AMOUNT: fmt(co.amount),
          }).subject,
          html_body: htmlBody,
          attachments: [
            {
              filename: fileName,
              content: pdfBase64,
              mime_type: "application/pdf",
            },
          ],
          project_id: co.project_id,
          change_order_id: co.id,
          tag_category: "client",
        },
      });

      if (sendError) throw new Error(sendError.message || "Failed to send email");
      if (sendResult?.error) throw new Error(sendResult.error);

      // Update CO status
      await sendCO.mutateAsync({ id: co.id, project_id: co.project_id, sent_to_email: contactEmail });
      toast({ title: "Sent to client", description: `${co.co_number} emailed to ${contactEmail} with signing link.` });
    } catch (e: any) {
      toast({ title: "Error sending CO", description: e.message, variant: "destructive" });
    }
  };

  // Keep ref in sync for the pre-return useEffect
  handleSendRef.current = handleSend;

  const handleApprove = async () => {
    try {
      await approveCO.mutateAsync({ id: co.id, project_id: co.project_id });
      toast({ title: `${co.co_number} approved`, description: "Change order marked as approved." });
      // Auto-save PDF to documents on approval
      savePdfToDocuments().catch(() => {});
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleVoid = async () => {
    try {
      await updateCO.mutateAsync({ id: co.id, project_id: co.project_id, status: "voided" });
      toast({ title: `${co.co_number} voided` });
      setVoidConfirmOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    try {
      await updateCO.mutateAsync({ id: co.id, project_id: co.project_id, status: "rejected" });
      toast({ title: `${co.co_number} rejected`, variant: "destructive" });
      setRejectConfirmOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateCO.mutateAsync({ id: co.id, project_id: co.project_id, notes });
      toast({ title: "Notes saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleEdit = async (data: ChangeOrderFormInput, asDraft: boolean) => {
    try {
      await updateCO.mutateAsync({
        id: co.id,
        project_id: co.project_id,
        title: data.title,
        description: data.description ?? null,
        reason: data.reason ?? null,
        amount: data.amount,
        requested_by: data.requested_by ?? null,
        linked_service_names: data.linked_service_names ?? [],
        line_items: data.line_items ?? [],
        notes: data.notes ?? null,
        deposit_percentage: data.deposit_percentage ?? 0,
        status: asDraft ? "draft" : co.status,
      } as any);
      toast({ title: "Change order updated" });
      setEditOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCO.mutateAsync({ id: co.id, project_id: co.project_id });
      onOpenChange(false);
      toast({ title: "Draft deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const generatePdfBlob = async (pendingSignatureData?: string) => {
    const settings = companySettings?.settings;
    // Use a merged CO object that includes any pending signature data
    // This handles the case where Sign & Send is used and the query hasn't refreshed yet
    const coForPdf = pendingSignatureData ? {
      ...co,
      internal_signature_data: pendingSignatureData,
      internal_signed_at: co.internal_signed_at || new Date().toISOString(),
      internal_signer_name: co.internal_signer_name || signerName || null,
    } : co;
    const { getLogoDataUrl } = await import("@/utils/logoToDataUrl");
    const logoUrl = await getLogoDataUrl(companySettings?.logo_url || settings?.company_logo_url || "");
    const blob = await pdf(
      <ChangeOrderPDF
        co={coForPdf}
        companyName={companySettings?.name}
        companyAddress={settings?.company_address || companySettings?.address || ""}
        companyPhone={settings?.company_phone || companySettings?.phone || ""}
        companyEmail={settings?.company_email || companySettings?.email || ""}
        companyWebsite={settings?.company_website || companySettings?.website || ""}
        companyFax={settings?.company_fax}
        projectAddress={projectInfo?.address}
        projectNumber={projectInfo?.project_number}
        clientName={projectInfo?.clients?.name}
        signerName={signerName || undefined}
        recipientName={sentToContact?.name || undefined}
        logoUrl={logoUrl}
        originalContractTotal={contractSummary?.originalTotal}
        previousCOsTotal={contractSummary?.priorCOsTotal}
        previousCOsCount={contractSummary?.priorCOsCount}
      />
    ).toBlob();
    return blob;
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const projectLabel = projectInfo?.project_number || projectInfo?.address?.split(",")[0] || "";
      const safeProject = projectLabel.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      const safeTitle = co.title.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      a.download = `${safeProject ? safeProject + "_" : ""}${co.co_number.replace("#", "")}_${safeTitle}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "PDF error", description: e.message, variant: "destructive" });
    }
  };

  const savePdfToDocuments = async () => {
    try {
      const blob = await generatePdfBlob();
      const fileName = `${co.co_number.replace("#", "")}_${co.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      const filePath = `${co.company_id}/${co.project_id}/change-orders/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("universal-documents")
        .upload(filePath, blob, { contentType: "application/pdf", upsert: true });

      if (uploadError) throw uploadError;

      // Save record in universal_documents table
      const { error: docError } = await supabase
        .from("universal_documents" as any)
        .insert({
          company_id: co.company_id,
          project_id: co.project_id,
          title: `${co.co_number} – ${co.title}`,
          filename: fileName,
          storage_path: filePath,
          mime_type: "application/pdf",
          size_bytes: blob.size,
          uploaded_by: profile?.id ?? null,
          category: "change_order",
        });

      if (docError) throw docError;

      toast({ title: "PDF saved", description: `${fileName} saved to project documents.` });
    } catch (e: any) {
      toast({ title: "Error saving PDF", description: e.message, variant: "destructive" });
    }
  };

  // Execute deferred auto-archive if flagged
  if (shouldAutoArchive.current) {
    shouldAutoArchive.current = false;
    supabase
      .from("universal_documents" as any)
      .select("id")
      .eq("project_id", co.project_id)
      .eq("category", "change_order")
      .ilike("filename", `%${co.co_number.replace("#", "")}%`)
      .limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          savePdfToDocuments().catch(() => {});
        }
      });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="!w-full !sm:max-w-[480px] !max-w-[480px] overflow-y-auto p-0">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b pr-12">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm text-muted-foreground">{co.co_number}</span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>
                </div>
                <SheetTitle className="text-lg leading-snug">{co.title}</SheetTitle>
                <SheetDescription className="mt-1">
                  Created {fmtDate(co.created_at)}
                  {co.requested_by && <> · Requested by {co.requested_by}</>}
                </SheetDescription>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-2xl font-bold tabular-nums ${co.amount < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {co.amount < 0 ? `-${fmt(Math.abs(co.amount))}` : fmt(co.amount)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {co.amount > 0 ? "Additional charge" : co.amount < 0 ? "Credit / reduction" : "No change"}
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="px-6 py-5 space-y-6">
            {/* Dual Signature Tracker */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg border p-3 text-sm ${internalSigned ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" : "bg-muted/30 border-border"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {internalSigned ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internal Signature</span>
                </div>
                {internalSigned ? (
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                    {signerName ? `${signerName} — ` : "Signed "}{fmtDate(co.internal_signed_at)}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Not yet signed</p>
                )}
              </div>

              <div className={`rounded-lg border p-3 text-sm ${clientSigned ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" : co.sent_at ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" : "bg-muted/30 border-border"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {clientSigned ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : co.sent_at ? <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Signature</span>
                </div>
                {clientSigned ? (
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                    {co.client_signer_name ? `${co.client_signer_name} — ` : ""}{fmtDate(co.client_signed_at)}
                  </p>
                ) : co.sent_at ? (
                  <div>
                    <p className="text-blue-700 dark:text-blue-300">Sent {fmtDate(co.sent_at)} — awaiting</p>
                    {sentToEmail && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">To: {sentToDisplay}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not yet sent</p>
                )}
              </div>
            </div>

            {/* Fully Executed Banner */}
            {fullyExecuted && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                <CheckCheck className="h-4 w-4" />
                Fully Executed — Approved {fmtDate(co.approved_at)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {canSign && (
                <Button size="sm" className="gap-1.5" onClick={() => { setSendAfterSign(true); setSignOpen(true); }}>
                  <PenLine className="h-3.5 w-3.5" /> Sign & Send
                </Button>
              )}
              {canSend && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleSend()}>
                  <Send className="h-3.5 w-3.5" /> Send to Client
                </Button>
              )}
              {canResend && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleSend()}>
                  <Send className="h-3.5 w-3.5" /> Resend to Client
                </Button>
              )}
              {canApprove && (
                <Button size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20" onClick={handleApprove}>
                  <CheckCheck className="h-3.5 w-3.5" /> Mark Approved
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {canReject && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setRejectConfirmOpen(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              )}
              {canVoid && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setVoidConfirmOpen(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Void
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleDelete}>
                  Delete Draft
                </Button>
              )}

              {/* More menu with PDF */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ml-auto">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadPdf} className="gap-2">
                    <FileDown className="h-3.5 w-3.5" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const blob = await generatePdfBlob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                    } catch (e: any) {
                      toast({ title: "Preview error", description: e.message, variant: "destructive" });
                    }
                  }} className="gap-2">
                    <Eye className="h-3.5 w-3.5" /> Preview PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Separator />

            {/* Details */}
            <div className="space-y-4">
              {/* Line Items */}
              {(() => {
                const items = Array.isArray((co as any).line_items) && (co as any).line_items.length > 0
                  ? (co as any).line_items
                  : co.linked_service_names?.map((name: string) => ({ name, amount: co.amount / (co.linked_service_names?.length || 1) }));
                return items && items.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Services</p>
                    <div className="space-y-1.5">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium">{item.name}</span>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                            )}
                          </div>
                          <span className="tabular-nums shrink-0">{fmt(item.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t text-sm font-semibold">
                      <span>{co.amount < 0 ? "Total Credit" : "Total"}</span>
                      <span className={`tabular-nums ${co.amount < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                        {co.amount < 0 ? `-${fmt(Math.abs(co.amount))}` : fmt(co.amount)}
                      </span>
                    </div>
                  </div>
                ) : co.description ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scope / Description</p>
                    <p className="text-sm whitespace-pre-line">{co.description}</p>
                  </div>
                ) : null;
              })()}

              {/* Deposit Info */}
              {(co as any).deposit_percentage > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deposit</p>
                  <p className="text-sm font-medium">
                    {(co as any).deposit_percentage}% — {fmt(Math.abs(co.amount) * (co as any).deposit_percentage / 100)}
                  </p>
                  {(co as any).deposit_paid_at ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Paid {fmtDate((co as any).deposit_paid_at)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Not yet paid</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internal Notes</p>
              <Textarea
                placeholder="Add internal notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={updateCO.isPending}>
                Save Notes
              </Button>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</p>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span>Created {fmtDate(co.created_at)}</span>
                </div>
                {co.internal_signed_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span>Signed internally{signerName ? ` by ${signerName}` : ""} {fmtDate(co.internal_signed_at)}</span>
                  </div>
                )}
                {co.sent_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span>Sent to {sentToDisplay} {fmtDate(co.sent_at)}</span>
                  </div>
                )}
                {co.client_signed_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Client signed {fmtDate(co.client_signed_at)}</span>
                  </div>
                )}
                {co.approved_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">Approved {fmtDate(co.approved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <ChangeOrderEmailThread changeOrderId={co.id} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Internal signature dialog */}
      <COSignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        onSign={handleSign}
        co={co}
        isLoading={signCO.isPending}
      />

      {/* Edit dialog */}
      <ChangeOrderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        isLoading={updateCO.isPending}
        existingCO={co}
        serviceNames={serviceNames}
      />

      {/* Void confirm */}
      <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Void {co.co_number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the change order as voided. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid}>Void CO</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject confirm */}
      <AlertDialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Reject {co.co_number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the change order as rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleReject}>Reject CO</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Email thread section for the CO detail sheet. Hides itself until first send. */
function ChangeOrderEmailThread({ changeOrderId }: { changeOrderId: string }) {
  const { data: emails = [], isLoading } = useChangeOrderEmails(changeOrderId);
  if (!isLoading && emails.length === 0) return null;
  return (
    <div className="mt-2 pt-4 border-t">
      <RecordEmailsSection
        taggedEmails={emails}
        isLoading={isLoading}
        recordLabel="change order"
      />
    </div>
  );
}
