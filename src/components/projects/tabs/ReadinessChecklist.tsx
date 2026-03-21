import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, ChevronRight, ChevronDown, Send, Plus, Trash2,
  ClipboardList, Sparkles, Eye, Mail, Phone, FileText,
  CheckCheck, XCircle, Pencil, User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, type ChecklistItem } from "@/hooks/useProjectChecklist";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { wrapEmailForSending } from "@/components/rfps/buildPartnerEmailTemplate";
import { useChecklistFollowupDrafts, useApproveDraft, useDismissDraft } from "@/hooks/useChecklistFollowupDrafts";
import { useGenerateProjectChecklist } from "@/hooks/useGenerateChecklist";
import { EditPISDialog } from "@/components/projects/EditPISDialog";
import { checklistCategoryLabels } from "@/components/projects/projectMockData";
import type { MockPISStatus } from "@/components/projects/projectMockData";
import { format } from "date-fns";

export function ReadinessChecklist({
  items, pisStatus, projectId,
  projectName, propertyAddress, ownerName, contactEmail,
  contacts,
}: {
  items: ChecklistItem[]; pisStatus: MockPISStatus; projectId: string;
  projectName?: string; propertyAddress?: string; ownerName?: string; contactEmail?: string;
  contacts?: Array<{ id?: string; name: string; email?: string; phone?: string; [key: string]: any }>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [showReceived, setShowReceived] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditPIS, setShowEditPIS] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newCategory, setNewCategory] = useState("missing_document");
  const [aiDraft, setAiDraft] = useState<{ draft: string; prompt: { system: string; user: string }; model: string } | null>(null);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const { data: companyData } = useCompanySettings();
  const { data: pendingDrafts = [] } = useChecklistFollowupDrafts(projectId);
  const approveDraft = useApproveDraft();
  const dismissDraft = useDismissDraft();
  const generateChecklist = useGenerateProjectChecklist();

  // Fetch RFI record for reminder sending
  const { data: rfiRecord } = useQuery({
    queryKey: ["rfi-reminder-data", projectId],
    queryFn: async () => {
      const { data } = await (supabase.from("rfi_requests" as any) as any)
        .select("id, recipient_name, recipient_email, access_token, last_reminder_sent_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; recipient_name: string | null; recipient_email: string | null; access_token: string; last_reminder_sent_at: string | null } | null;
    },
    enabled: !!projectId,
  });

  const handleSendPISReminder = async () => {
    if (!rfiRecord?.access_token || !reminderEmail) return;
    const now = new Date();

    setSendingReminder(true);
    try {
      const pisUrl = `${window.location.origin}/rfi?token=${rfiRecord.access_token}&reminder=true`;
      const recipientName = rfiRecord.recipient_name || "there";
      const subject = `Reminder: Project Information Sheet — ${projectName || "Your Project"}`;
      const innerBody = `
        <p>Hi ${recipientName},</p>
        <p>This is a friendly reminder to complete the <strong>Project Information Sheet</strong> for <strong>${projectName || "your project"}</strong>${propertyAddress ? ` at ${propertyAddress}` : ""}.</p>
        <p>The form is partially complete. Please click the link below to finish filling it out:</p>
        <p><a href="${pisUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Complete PIS →</a></p>
        <p>If you've already submitted this, please disregard this message.</p>
        <p>Thank you,<br/>${companyData?.name || "Our Team"}</p>
      `;
      const htmlBody = wrapEmailForSending(innerBody, companyData?.settings?.company_logo_url);

      const { error: sendErr } = await supabase.functions.invoke("gmail-send", {
        body: { to: reminderEmail, subject, html_body: htmlBody },
      });
      if (sendErr) throw sendErr;

      await (supabase.from("rfi_requests" as any) as any)
        .update({ last_reminder_sent_at: now.toISOString() })
        .eq("id", rfiRecord.id);

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("id, company_id").eq("user_id", user!.id).single();
      if (profile) {
        await supabase.from("project_timeline_events").insert({
          company_id: profile.company_id,
          project_id: projectId,
          event_type: "pis_reminder_sent",
          description: `PIS reminder sent to ${reminderEmail}`,
          actor_id: profile.id,
          metadata: { recipient_email: reminderEmail, rfi_id: rfiRecord.id },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["rfi-reminder-data", projectId] });
      queryClient.invalidateQueries({ queryKey: ["timeline-events", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-timeline", projectId] });
      setShowReminderDialog(false);
      toast({ title: "Reminder sent ✓", description: `PIS reminder sent to ${reminderEmail}.` });
    } catch (err: any) {
      toast({ title: "Failed to send reminder", description: err.message || "Check your Gmail connection.", variant: "destructive" });
    } finally {
      setSendingReminder(false);
    }
  };

  const getDaysWaiting = (requestedDate: string | null) => {
    if (!requestedDate) return 0;
    const diff = Date.now() - new Date(requestedDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const outstanding = items.filter(i => i.status === "open");
  const completed = items.filter(i => i.status === "done" || i.status === "dismissed");
  const grouped = (() => {
    const knownGroups = Object.entries(checklistCategoryLabels).map(([key, { label, icon }]) => ({
      key, label, icon,
      items: outstanding.filter(i => i.category === key),
    })).filter(g => g.items.length > 0);
    const knownKeys = new Set(Object.keys(checklistCategoryLabels));
    const uncategorized = outstanding.filter(i => !knownKeys.has(i.category));
    if (uncategorized.length > 0) {
      knownGroups.push({ key: "_other", label: "Other", icon: "📌", items: uncategorized });
    }
    return knownGroups;
  })();

  const pisComplete = pisStatus.completedFields === pisStatus.totalFields;

  const handleMarkDone = (id: string) => {
    updateItem.mutate({ id, projectId, status: "done" });
    toast({ title: "Received ✓", description: "Item moved to received list." });
  };

  const handleRemoveItem = (id: string) => {
    deleteItem.mutate({ id, projectId });
    toast({ title: "Removed", description: "Item removed from checklist." });
  };

  const handleAddItem = () => {
    if (!newLabel.trim()) return;
    addItem.mutate({
      project_id: projectId,
      label: newLabel,
      category: newCategory,
      from_whom: newFrom || undefined,
    });
    toast({ title: "Item added", description: newLabel });
    setNewLabel(""); setNewFrom(""); setShowAddForm(false);
  };

  const handleAiFollowUp = async () => {
    if (outstanding.length === 0) {
      toast({ title: "No outstanding items", description: "All checklist items are complete." });
      return;
    }
    setAiLoading(true);
    try {
      const itemsPayload = outstanding.map(item => ({
        label: item.label,
        from_whom: item.from_whom,
        category: item.category,
        daysWaiting: getDaysWaiting(item.requested_date),
      }));

      const completedPayload = completed
        .filter(i => i.status === "done")
        .map(item => ({
          label: item.label,
          category: item.category,
          completedAt: item.completed_at ? new Date(item.completed_at).toLocaleDateString("en-US") : "recently",
        }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-checklist-followup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            items: itemsPayload,
            completedItems: completedPayload,
            projectName,
            propertyAddress,
            ownerName,
            contactEmail,
            firmName: companyData?.name || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        toast({ title: "AI Error", description: err.error || `Status ${resp.status}`, variant: "destructive" });
        return;
      }

      const data = await resp.json();
      setAiDraft(data);
      setShowAiDraft(true);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to generate draft", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={(() => {
        const pisMissing = pisStatus.totalFields - pisStatus.completedFields;
        const totalIssues = outstanding.length + pisMissing;
        if (totalIssues === 0) return "border-l-4 border-l-green-500 bg-green-500/5";
        if (totalIssues > 10 || outstanding.length > 3) return "border-l-4 border-l-red-500 bg-red-500/5";
        return "border-l-4 border-l-amber-500 bg-amber-500/5";
      })()}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  Project Readiness
                  {(() => {
                    const pisMissing = pisStatus.totalFields - pisStatus.completedFields;
                    const totalIssues = outstanding.length + pisMissing;
                    if (totalIssues === 0) return (
                      <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        All clear
                      </Badge>
                    );
                    return (
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {totalIssues} outstanding
                      </Badge>
                    );
                  })()}
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm" onClick={(e) => {
                  if (!pisComplete) {
                    e.stopPropagation();
                    setIsOpen(true);
                  }
                }}>
                  <span className="text-muted-foreground">PIS:</span>
                  {pisComplete ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer hover:opacity-80">
                      {pisStatus.completedFields}/{pisStatus.totalFields} fields
                    </Badge>
                  )}
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            {!isOpen && pisStatus.totalFields > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pisComplete ? "bg-green-500" : pisStatus.completedFields / pisStatus.totalFields >= 0.5 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${(pisStatus.completedFields / pisStatus.totalFields) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pisStatus.completedFields}/{pisStatus.totalFields} PIS fields complete
                  {outstanding.length > 0 && ` · ${outstanding.length} checklist items open`}
                </p>
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {pisStatus.sentDate ? (
                <div className={`flex items-center gap-4 p-3 rounded-lg border ${
                  pisComplete
                    ? "bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/30"
                    : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">Project Information Sheet</span>
                      <span className="text-muted-foreground text-xs">Sent {pisStatus.sentDate}</span>
                    </div>
                    {!pisComplete && (
                      <>
                        <Progress value={(pisStatus.completedFields / pisStatus.totalFields) * 100} className="h-2" />
                        {pisStatus.missingBySection && Object.keys(pisStatus.missingBySection).length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {Object.entries(pisStatus.missingBySection).map(([section, fields]) => (
                              <div key={section} className="text-xs">
                                <span className="font-medium text-foreground/70">{section}:</span>{" "}
                                <span className="text-muted-foreground">{fields.join(", ")}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-1">
                            Missing: {pisStatus.missingFields.join(", ")}
                          </div>
                        )}
                      </>
                    )}
                    {pisComplete && (
                      <p className="text-xs text-green-700 dark:text-green-400">{pisStatus.completedFields}/{pisStatus.totalFields} fields complete</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setShowEditPIS(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit PIS
                  </Button>
                  {!pisComplete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => {
                        setReminderEmail(rfiRecord?.recipient_email || contactEmail || "");
                        setShowReminderDialog(true);
                      }}
                    >
                      <Send className="h-3.5 w-3.5" /> Send Reminder
                    </Button>
                  )}
                </div>
            ) : (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">No Project Information Sheet sent yet</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Sending a PIS will auto-populate contacts, services, and project details from the client.
                  </div>
                </div>
                <Button size="sm" className="shrink-0 gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send PIS
                </Button>
              </div>
            )}

            {/* Auto-generated follow-up drafts banner */}
            {pendingDrafts.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {pendingDrafts.length} auto-generated follow-up{pendingDrafts.length > 1 ? "s" : ""} ready for review
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => {
                    const draft = pendingDrafts[0];
                    setAiDraft({
                      draft: draft.draft_body,
                      prompt: { system: draft.prompt_system || "", user: draft.prompt_user || "" },
                      model: "auto-generated",
                    });
                    setShowAiDraft(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> Review
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    approveDraft.mutate(pendingDrafts[0].id);
                    toast({ title: "Approved", description: "Follow-up draft approved." });
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    dismissDraft.mutate(pendingDrafts[0].id);
                    toast({ title: "Dismissed", description: "Follow-up draft dismissed." });
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            )}

            {/* PIS Submitted Data */}
            {pisStatus.sentDate && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2">
                    <ChevronRight className="h-3 w-3" />
                    📋 PIS Responses — {pisStatus.completedFields}/{pisStatus.totalFields} fields
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {pisStatus.answeredFields && pisStatus.answeredFields.length > 0 ? (
                    <div className="rounded-lg border bg-muted/10 overflow-hidden">
                      {(() => {
                        const bySection: Record<string, Array<{ label: string; value: string }>> = {};
                        for (const f of pisStatus.answeredFields!) {
                          if (!bySection[f.section]) bySection[f.section] = [];
                          bySection[f.section].push({ label: f.label, value: f.value });
                        }
                        return Object.entries(bySection).map(([section, fields]) => (
                          <div key={section} className="border-b last:border-b-0">
                            <div className="px-3 py-1.5 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {section}
                            </div>
                            <div className="divide-y">
                              {fields.map((f, i) => (
                                <div key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
                                  <span className="text-muted-foreground min-w-[140px] shrink-0">{f.label}</span>
                                  <span className="font-medium break-words">{f.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground p-3 text-center">No responses submitted yet.</div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {grouped.map(({ key, label, icon, items: groupItems }) => (
              <div key={key}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {icon} {label} ({groupItems.length})
                </h4>
                <div className="space-y-1.5">
                  {groupItems.map((item) => {
                    const daysWaiting = getDaysWaiting(item.requested_date);
                    return (
                      <div key={item.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-background border group/item">
                        <Checkbox className="h-4 w-4" onCheckedChange={() => handleMarkDone(item.id)} />
                        <span className="flex-1 min-w-0">{item.label}</span>
                        {item.from_whom && <span className="text-xs text-muted-foreground shrink-0">from {item.from_whom}</span>}
                        <Badge variant={daysWaiting > 7 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                          {daysWaiting}d
                        </Badge>
                        <div className="flex items-center gap-1 shrink-0">
                          {(item.category === "missing_document" || item.category === "document") && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Request Sent", description: `Requested "${item.label}" from ${item.from_whom}` })}>
                              <Mail className="h-3 w-3" /> Request
                            </Button>
                          )}
                          {(item.category === "missing_info" || item.category === "field") && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Email Draft", description: `Drafting email to request "${item.label}"` })}>
                              <Mail className="h-3 w-3" /> Email
                            </Button>
                          )}
                          {(item.category === "pending_signature" || item.category === "approval") && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Reminder Sent", description: `Reminder sent for "${item.label}"` })}>
                              <Send className="h-3 w-3" /> Remind
                            </Button>
                          )}
                          {(item.category === "pending_response" || item.category === "inspection") && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Follow-up Sent", description: `Follow-up sent for "${item.label}"` })}>
                              <Phone className="h-3 w-3" /> Follow Up
                            </Button>
                          )}
                          {item.category === "ai_follow_up" && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                              <Sparkles className="h-2.5 w-2.5" /> AI
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {completed.length > 0 && (
              <Collapsible open={showReceived} onOpenChange={setShowReceived}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-7 px-2">
                    {showReceived ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    ✅ Received ({completed.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1">
                  <div className="space-y-1">
                    {completed.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-md text-muted-foreground">
                        <Checkbox checked className="h-4 w-4" />
                        <span className="line-through">{item.label}</span>
                        {item.from_whom && <span className="text-xs ml-auto">from {item.from_whom}</span>}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {showAddForm ? (
              <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="What's needed?" className="h-8 text-sm" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} autoFocus />
                  <Input placeholder="From whom?" className="h-8 text-sm" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(checklistCategoryLabels).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddItem} disabled={addItem.isPending}>Add</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNewLabel(""); setNewFrom(""); setShowAddForm(false); }}>Cancel</Button>
                </div>
              </div>
            ) : (
               <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
                {items.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => {
                      generateChecklist.mutate({
                        project_id: projectId,
                        filing_type: (window as any).__currentFilingType,
                        project_description: projectName,
                      });
                    }}
                    disabled={generateChecklist.isPending}
                  >
                    {generateChecklist.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> Generate AI Checklist</>
                    )}
                  </Button>
                )}
                {outstanding.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={handleAiFollowUp}
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting...</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> AI Follow-Up Draft</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    <EditPISDialog open={showEditPIS} onOpenChange={setShowEditPIS} pisStatus={pisStatus} projectId={projectId} />

    {/* PIS Reminder Dialog */}
    <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send PIS Reminder</DialogTitle>
          <DialogDescription>
            Send a reminder to complete the Project Information Sheet.
            {rfiRecord?.last_reminder_sent_at && (
              <span className="block mt-1 text-xs">
                Last reminder: {format(new Date(rfiRecord.last_reminder_sent_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rfiRecord?.recipient_name && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <span className="font-medium">{rfiRecord.recipient_name}</span>
                {rfiRecord.recipient_email && (
                  <span className="text-muted-foreground ml-1.5">({rfiRecord.recipient_email})</span>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reminder-email" className="text-sm">Recipient Email</Label>
            <Input
              id="reminder-email"
              type="email"
              value={reminderEmail}
              onChange={(e) => setReminderEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          {contacts && contacts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Or pick a contact</Label>
              <div className="flex flex-wrap gap-1.5">
                {contacts
                  .filter((c: any) => c.email)
                  .slice(0, 6)
                  .map((c: any) => (
                    <button
                      key={c.id || c.email}
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        reminderEmail === c.email
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border"
                      }`}
                      onClick={() => setReminderEmail(c.email)}
                    >
                      {c.name || c.email}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {rfiRecord?.recipient_email && reminderEmail !== rfiRecord.recipient_email && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setReminderEmail(rfiRecord.recipient_email!)}
            >
              Reset to original: {rfiRecord.recipient_email}
            </button>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => setShowReminderDialog(false)}>Cancel</Button>
          <Button onClick={handleSendPISReminder} disabled={sendingReminder || !reminderEmail} className="gap-1.5">
            {sendingReminder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Reminder
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* AI Draft Dialog */}
    <Dialog open={showAiDraft} onOpenChange={setShowAiDraft}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Follow-Up Draft
          </DialogTitle>
        </DialogHeader>

        {aiDraft && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Generated Email Draft</span>
                <Badge variant="outline" className="text-[10px]">
                  {aiDraft.model} · {(aiDraft as any).itemCount} items
                </Badge>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{aiDraft.draft}</pre>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => {
                  navigator.clipboard.writeText(aiDraft.draft);
                  toast({ title: "Copied", description: "Draft copied to clipboard." });
                }}>
                  <FileText className="h-3.5 w-3.5" /> Copy Draft
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  toast({ title: "Opening Composer", description: "Draft will be loaded into email composer." });
                  setShowAiDraft(false);
                }}>
                  <Mail className="h-3.5 w-3.5" /> Open in Composer
                </Button>
              </div>
            </div>

            <Separator />

            <Collapsible open={showPrompt} onOpenChange={setShowPrompt}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground w-full justify-start h-8">
                  {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Eye className="h-3 w-3" />
                  View Prompt Used
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt</span>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">{aiDraft.prompt.system}</pre>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Prompt</span>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">{aiDraft.prompt.user}</pre>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
