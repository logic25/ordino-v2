import { useState, useMemo, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Calendar, DollarSign, Target, Sparkles, Building2, Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useUpdateDiscoveredRfp, type DiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { RecommendedCompaniesSection } from "@/components/rfps/RecommendedCompaniesSection";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { useClients } from "@/hooks/useClients";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useRfpContent, useNotableApplications } from "@/hooks/useRfpContent";
import { buildPartnerEmailSubject, buildPartnerEmailBody } from "./buildPartnerEmailTemplate";
import { CompanyProfilePDF, type CompanyProfileData } from "./CompanyProfilePDF";
import { pdf } from "@react-pdf/renderer";
import { supabase } from "@/integrations/supabase/client";
import { usePartnerOutreach, useCreatePartnerOutreach } from "@/hooks/usePartnerOutreach";

interface Props {
  rfp: DiscoveredRfp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateResponse?: (rfp: DiscoveredRfp) => void;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 80 ? "text-success bg-success/10 border-success/30"
    : score >= 60 ? "text-warning bg-warning/10 border-warning/30"
    : "text-destructive bg-destructive/10 border-destructive/30";
  return (
    <Badge variant="outline" className={`text-sm font-bold tabular-nums ${color}`}>
      <Target className="h-3.5 w-3.5 mr-1" /> {score}
    </Badge>
  );
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-muted-foreground" />,
  interested: <CheckCircle2 className="h-3 w-3 text-success" />,
  passed: <XCircle className="h-3 w-3 text-muted-foreground" />,
};

export function DiscoveryDetailSheet({ rfp, open, onOpenChange, onGenerateResponse }: Props) {
  const update = useUpdateDiscoveredRfp();
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: clients = [] } = useClients();
  const { data: companySettingsData } = useCompanySettings();
  const { data: contentItems = [] } = useRfpContent();
  const { data: notableProjects = [] } = useNotableApplications();
  const { data: outreachRecords = [] } = usePartnerOutreach(rfp?.id);
  const createOutreach = useCreatePartnerOutreach();
  const { toast } = useToast();
  const [notes, setNotes] = useState(rfp?.notes || "");
  const [emailBlastOpen, setEmailBlastOpen] = useState(false);
  const [emailBlastRecipients, setEmailBlastRecipients] = useState<string[]>([]);
  const [emailBlastSubject, setEmailBlastSubject] = useState("");
  const [emailBlastBody, setEmailBlastBody] = useState("");
  const [emailBlastAttachments, setEmailBlastAttachments] = useState<{ file: File; name: string; size: number; base64?: string }[]>([]);

  // Outreach log grouped by client
  const outreachByClient = useMemo(() => {
    const map: Record<string, typeof outreachRecords[0]> = {};
    for (const o of outreachRecords) {
      map[o.partner_client_id] = o;
    }
    return map;
  }, [outreachRecords]);

  if (!rfp) return null;

  const daysUntilDue = rfp.due_date ? differenceInDays(new Date(rfp.due_date), new Date()) : null;

  // Build response URL base
  const responseBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rfp-partner-response`;

  const handleStatusChange = async (status: string) => {
    await update.mutateAsync({ id: rfp.id, status } as any);
  };

  const handleAssign = async (profileId: string) => {
    await update.mutateAsync({ id: rfp.id, assigned_to: profileId || null } as any);
  };

  const handleSaveNotes = async () => {
    await update.mutateAsync({ id: rfp.id, notes } as any);
    toast({ title: "Notes saved" });
  };

  const handleEmailBlast = async (companyIds: string[]) => {
    // Fetch primary contacts for selected companies
    const { data: contactsData } = await supabase
      .from("client_contacts")
      .select("email, client_id, is_primary, name, title")
      .in("client_id", companyIds)
      .not("email", "is", null)
      .order("is_primary", { ascending: false });

    const selectedClients = clients.filter((c) => companyIds.includes(c.id));
    const contactsByClient: Record<string, { email: string; name: string; title: string | null }> = {};
    for (const ct of contactsData || []) {
      if (ct.email && (!contactsByClient[ct.client_id] || ct.is_primary)) {
        contactsByClient[ct.client_id] = { email: ct.email, name: ct.name, title: ct.title };
      }
    }

    const emails = selectedClients
      .map((c) => contactsByClient[c.id]?.email || c.email)
      .filter(Boolean) as string[];
    
    if (emails.length === 0) {
      toast({ title: "No emails found", description: "The selected partners don't have contact email addresses on file.", variant: "destructive" });
      return;
    }

    // Get company name
    let companyName = "Our Firm";
    if (companySettingsData?.companyId) {
      const { data: co } = await supabase.from("companies").select("name, logo_url").eq("id", companySettingsData.companyId).single();
      if (co?.name) companyName = co.name;
    }

    const companyInfo = {
      name: companyName,
      address: companySettingsData?.settings.company_address,
      phone: companySettingsData?.settings.company_phone,
      email: companySettingsData?.settings.company_email,
      website: companySettingsData?.settings.company_website,
      logo_url: companySettingsData?.settings.company_logo_url,
    };

    // Create outreach records so we get tokens for response buttons
    const outreachInserts = selectedClients.map((c) => ({
      company_id: rfp.company_id,
      discovered_rfp_id: rfp.id,
      partner_client_id: c.id,
      contact_name: contactsByClient[c.id]?.name || c.name,
      contact_email: contactsByClient[c.id]?.email || c.email,
    }));

    let outreachData: any[] = [];
    try {
      outreachData = await createOutreach.mutateAsync(outreachInserts) || [];
    } catch (err) {
      console.error("Failed to create outreach records:", err);
    }

    // Build email body — for now use a generic body (individual tokens would require per-recipient emails)
    // We'll use the first token as a placeholder; in production this would be per-recipient
    const firstToken = outreachData[0]?.response_token;
    const body = buildPartnerEmailBody(rfp, companyInfo, companySettingsData?.settings || null, contentItems, notableProjects, responseBaseUrl, firstToken);
    const subject = buildPartnerEmailSubject(rfp);

    // Generate Company Profile PDF
    try {
      const profileData: CompanyProfileData = {
        company: companyInfo,
        aboutUs: (() => {
          const historyItem = contentItems.find(c => c.content_type === "firm_history");
          if (historyItem) {
            const content = historyItem.content as Record<string, string> | null;
            return content?.text || historyItem.title;
          }
          return null;
        })(),
        services: (companySettingsData?.settings?.service_catalog || []).slice(0, 10),
        staffBios: contentItems.filter(c => c.content_type === "staff_bio").slice(0, 5),
        notableProjects: notableProjects.slice(0, 5),
        certifications: contentItems.filter(c => c.content_type === "certification"),
      };

      const blob = await pdf(<CompanyProfilePDF data={profileData} />).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const pdfFile = new File([blob], `${companyInfo.name.replace(/\s+/g, "_")}_Company_Profile.pdf`, { type: "application/pdf" });
      setEmailBlastAttachments([{ file: pdfFile, name: pdfFile.name, size: pdfFile.size, base64 }]);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setEmailBlastAttachments([]);
    }
    
    setEmailBlastRecipients(emails);
    setEmailBlastSubject(subject);
    setEmailBlastBody(body);
    setEmailBlastOpen(true);
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg pr-6">{rfp.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Score + Status */}
          <div className="flex items-center justify-between">
            <ScoreBadge score={rfp.relevance_score} />
            <Select value={rfp.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            {rfp.issuing_agency && (
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Agency</p>
                <p className="text-sm mt-0.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {rfp.issuing_agency}
                </p>
              </div>
            )}
            {rfp.rfp_number && (
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">RFP #</p>
                <p className="text-sm mt-0.5 font-mono">{rfp.rfp_number}</p>
              </div>
            )}
            {rfp.due_date && (
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Due Date</p>
                <p className="text-sm mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(rfp.due_date), "MMM d, yyyy")}
                  {daysUntilDue !== null && (
                    <Badge variant="outline" className={`text-[10px] ml-1 ${daysUntilDue <= 7 ? "text-destructive border-destructive/30" : daysUntilDue <= 14 ? "text-warning border-warning/30" : ""}`}>
                      {daysUntilDue > 0 ? `${daysUntilDue}d left` : "Overdue"}
                    </Badge>
                  )}
                </p>
              </div>
            )}
            {rfp.estimated_value && (
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Est. Value</p>
                <p className="text-sm mt-0.5 flex items-center gap-1 text-success tabular-nums">
                  <DollarSign className="h-3 w-3" />
                  {rfp.estimated_value.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Service Tags */}
          {rfp.service_tags && rfp.service_tags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Service Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {rfp.service_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI Reasoning */}
          {rfp.relevance_reason && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-accent font-semibold flex items-center gap-1 mb-1">
                <Sparkles className="h-3 w-3" /> AI Analysis
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{rfp.relevance_reason}</p>
            </div>
          )}

          <Separator />

          {/* Assignment */}
          <div className="space-y-1.5">
            <Label className="text-xs">Assigned To</Label>
            <Select value={rfp.assigned_to || "__unassigned__"} onValueChange={(v) => handleAssign(v === "__unassigned__" ? "" : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || `${p.first_name} ${p.last_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add internal notes..."
            />
            {notes !== (rfp.notes || "") && (
              <Button size="sm" variant="outline" onClick={handleSaveNotes}>
                Save Notes
              </Button>
            )}
          </div>

          <Separator />

          {/* Recommended Companies */}
          <RecommendedCompaniesSection rfp={rfp} onEmailBlast={handleEmailBlast} />

          {/* Partner Outreach Log */}
          {outreachRecords.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Mail className="h-3 w-3" /> Outreach Log
              </Label>
              <div className="space-y-1.5">
                {outreachRecords.map((o) => {
                  const client = clients.find((c) => c.id === o.partner_client_id);
                  return (
                    <div key={o.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name || "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {o.contact_name && <span>{o.contact_name} · </span>}
                          Sent {format(new Date(o.notified_at), "MMM d")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {statusIcon[o.response_status] || statusIcon.pending}
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            o.response_status === "interested"
                              ? "text-success border-success/30 bg-success/10"
                              : o.response_status === "passed"
                              ? "text-muted-foreground"
                              : "text-warning border-warning/30"
                          }`}
                        >
                          {o.response_status}
                        </Badge>
                        {o.responded_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(o.responded_at), "MMM d")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {onGenerateResponse && (
              <Button onClick={() => onGenerateResponse(rfp)} className="glow-amber">
                <Sparkles className="h-4 w-4 mr-2" /> Generate Response
              </Button>
            )}
            {rfp.original_url && (
              <Button variant="outline" asChild>
                <a href={rfp.original_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> View Original
                </a>
              </Button>
            )}
            {rfp.status !== "passed" && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => handleStatusChange("passed")}
              >
                Pass on this RFP
              </Button>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Email Blast Compose Dialog */}
      <ComposeEmailDialog
        open={emailBlastOpen}
        onOpenChange={setEmailBlastOpen}
        defaultTo={emailBlastRecipients.join(", ")}
        defaultSubject={emailBlastSubject}
        defaultBody={emailBlastBody}
        defaultAttachments={emailBlastAttachments}
      />
    </Sheet>
  );
}
