import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Flame, Loader2, Pencil, FilePlus2, Trophy, Ban, Check, CalendarClock, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useLead, useUpdateLead, type LeadStage } from "@/hooks/useLeads";
import { useCreateBdActivity } from "@/hooks/useBdActivities";
import { useConvertLeadToProposal } from "@/hooks/useLeadConversion";
import { LineageBreadcrumb } from "@/components/shared/LineageBreadcrumb";
import { LeadConnectionsCard } from "@/components/bd/LeadConnectionsCard";
import { LeadStageStepper } from "@/components/bd/LeadStageStepper";
import { BdActivityThread } from "@/components/bd/BdActivityThread";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import {
  STAGE_META, SOURCE_META, TIMELINE_LABELS, stageRank, profileLabel,
} from "@/components/bd/leadConstants";

const CLIENT_TYPES = [
  "homeowner", "property_manager", "contractor", "architect",
  "developer", "management_company", "government", "other",
];

/** Click-to-edit text field with a hover pencil. Saves on blur or Enter. */
function EditableText({
  value, onSave, placeholder = "Add value", forceEdit = false,
}: {
  value: string | null;
  onSave: (v: string) => void;
  placeholder?: string;
  forceEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const isEditing = editing || forceEdit;
  if (isEditing) {
    return (
      <Input
        autoFocus={editing}
        className="h-8"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== (value ?? "")) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    );
  }
  const empty = !value;
  return (
    <button
      type="button"
      className="group flex w-full items-center justify-between gap-2 rounded px-1.5 -mx-1.5 py-1 text-left text-sm hover:bg-muted/50 transition-colors"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
    >
      <span className={cn(empty && "text-muted-foreground italic")}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-center py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

export default function BdLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: lead, isLoading } = useLead(id);
  const { data: profiles = [] } = useAssignableProfiles();
  const update = useUpdateLead();
  const convert = useConvertLeadToProposal();
  const createActivity = useCreateBdActivity();

  const [editAll, setEditAll] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);

  if (isLoading) {
    return <AppLayout><div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div></AppLayout>;
  }
  if (!lead) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Lead not found. <Link to="/bd/leads" className="text-primary underline">Back to Leads</Link></div></AppLayout>;
  }

  const set = (updates: Record<string, any>) => update.mutate({ id: lead.id, ...updates });
  const stageMeta = lead.stage ? STAGE_META[lead.stage] : null;
  const canCreateProposal = stageRank(lead.stage) >= stageRank("QUALIFIED");
  const showWonLost = lead.stage === "PROPOSAL";

  const handleCreateProposal = () => {
    // Non-blocking prefill: open ProposalDialog with lead's free-text address.
    // The dialog resolves it via useNYCPropertyLookup in the background.
    const params = new URLSearchParams();
    if (lead.property_address) params.set("address", lead.property_address);
    params.set("leadId", lead.id);
    navigate(`/proposals?${params.toString()}`);
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bd/leads")}><ArrowLeft className="mr-2 h-4 w-4" />Leads</Button>

        {/* HEADER */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{lead.full_name}</h1>
              {lead.company && <p className="text-muted-foreground">{lead.company}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {stageMeta && (
                  <Badge variant="outline" className={stageMeta.className}>{stageMeta.label}</Badge>
                )}
                {lead.source_type && (() => {
                  const Icon = SOURCE_META[lead.source_type].icon;
                  return <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" />{SOURCE_META[lead.source_type].label}</Badge>;
                })()}
                <button onClick={() => set({ hot_opportunity: !lead.hot_opportunity })} aria-label="Toggle hot">
                  <Flame className={`h-4 w-4 ${lead.hot_opportunity ? "text-orange-500 fill-orange-500" : "text-muted-foreground/40"}`} />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditAll((v) => !v)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {editAll ? "Done editing" : "Edit details"}
              </Button>
              {canCreateProposal && (
                <Button size="sm" onClick={handleCreateProposal}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Create Proposal
                </Button>
              )}
              {showWonLost && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    onClick={() => set({ stage: "WON" as LeadStage })}>
                    <Trophy className="mr-1.5 h-3.5 w-3.5" />Mark Won
                  </Button>
                  <Button size="sm" variant="outline" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    onClick={() => set({ stage: "LOST" as LeadStage })}>
                    <Ban className="mr-1.5 h-3.5 w-3.5" />Mark Lost
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* STAGE STEPPER */}
          <Card className="p-3">
            <LeadStageStepper
              current={lead.stage}
              onChange={(s) => set({ stage: s })}
            />
          </Card>

          {/* NEXT FOLLOW-UP — personal cadence (not an automated sequence) */}
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Next follow-up
              </p>
              {(lead.next_follow_up_at || lead.follow_up_note) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => set({ next_follow_up_at: null, follow_up_note: null })}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                defaultValue={lead.next_follow_up_at ?? ""}
                onChange={(e) => set({ next_follow_up_at: e.target.value || null })}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                key={`d-${lead.id}-${lead.next_follow_up_at ?? ""}`}
              />
              <input
                type="text"
                placeholder="Note — e.g. met at REBNY, discuss Hudson Yards"
                defaultValue={lead.follow_up_note ?? ""}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v !== (lead.follow_up_note ?? null)) set({ follow_up_note: v });
                }}
                className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                key={`n-${lead.id}-${lead.follow_up_note ?? ""}`}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Personal reminder — shows in <span className="font-medium">BD → Follow-ups</span>. Not an automated email. Use <span className="font-medium">Clear</span> to dismiss.
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT — data */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Identity</p>
              <Field label="Name"><EditableText value={lead.full_name} onSave={(v) => set({ full_name: v })} placeholder="Add name" forceEdit={editAll} /></Field>
              <Field label="Company">
                <div className="space-y-1">
                  <EditableText
                    value={lead.company}
                    onSave={(v) => set({ company: v })}
                    placeholder={suggestCompanyFromRole(lead.role) ?? "Add company"}
                    forceEdit={editAll}
                  />
                  {!lead.company && suggestCompanyFromRole(lead.role) && (
                    <button
                      type="button"
                      onClick={() => set({ company: suggestCompanyFromRole(lead.role)! })}
                      className="text-[11px] text-primary hover:underline pl-1.5"
                    >
                      Use suggested: "{suggestCompanyFromRole(lead.role)}"
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Role"><EditableText value={lead.role} onSave={(v) => set({ role: v })} placeholder="Add role" forceEdit={editAll} /></Field>
              <Field label="Email"><EditableText value={lead.contact_email} onSave={(v) => set({ contact_email: v })} placeholder="Add email" forceEdit={editAll} /></Field>
              <Field label="Phone"><EditableText value={lead.contact_phone} onSave={(v) => set({ contact_phone: v })} placeholder="Add phone" forceEdit={editAll} /></Field>
              <Field label="Address">
                <EditableText
                  value={(lead as any).contact_address ?? null}
                  onSave={(v) => set({ contact_address: v } as any)}
                  placeholder="Add mailing/office address"
                  forceEdit={editAll}
                />
              </Field>
              <Field label="Client type">
                <Select value={lead.client_type ?? undefined} onValueChange={(v) => set({ client_type: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Set client type" /></SelectTrigger>
                  <SelectContent>{CLIENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project Details</p>
              <Field label="Subject"><EditableText value={lead.subject} onSave={(v) => set({ subject: v })} placeholder="Add subject" forceEdit={editAll} /></Field>
              <Field label="Property"><EditableText value={lead.property_address} onSave={(v) => set({ property_address: v })} placeholder="Add address" forceEdit={editAll} /></Field>
              {(lead.architect_name || editAll) && (
                <Field label="Architect"><EditableText value={lead.architect_name} onSave={(v) => set({ architect_name: v })} placeholder="Add architect" forceEdit={editAll} /></Field>
              )}
              {(lead.gc_name || editAll) && (
                <Field label="GC"><EditableText value={lead.gc_name} onSave={(v) => set({ gc_name: v })} placeholder="Add GC" forceEdit={editAll} /></Field>
              )}
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Qualification</p>
              <Field label="Timeline">
                <Select value={lead.project_timeline ?? undefined} onValueChange={(v) => set({ project_timeline: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Set timeline" /></SelectTrigger>
                  <SelectContent>{Object.entries(TIMELINE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Expected value">
                <EditableText
                  value={lead.expected_value != null ? String(lead.expected_value) : null}
                  onSave={(v) => set({ expected_value: v ? Number(v) : null })}
                  placeholder="Add expected value"
                  forceEdit={editAll}
                />
              </Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Assignment</p>
              <Field label="Owner">
                <Select value={lead.assigned_to ?? undefined} onValueChange={(v) => set({ assigned_to: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Card>

            <Field label="Notes">
              <Card className="p-3">
                <EditableText
                  value={(lead as any).notes ?? null}
                  onSave={(v) => set({ notes: v })}
                  placeholder="Add a note…"
                  forceEdit={editAll}
                />
              </Card>
            </Field>

            {/* Source-specific */}
            {lead.source_type === "EVENT" && lead.event && (
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Source — Event</p>
                <Link to="/bd/events" className="text-sm text-primary underline">
                  {lead.event.name}{lead.event.start_date ? ` — ${format(new Date(lead.event.start_date), "MMM d, yyyy")}` : ""}
                </Link>
              </Card>
            )}
            {lead.source_type === "REFERRAL" && (lead.referrer || lead.referred_by) && (
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Source — Referral</p>
                {lead.referrer
                  ? <Link to={`/clients`} className="text-sm text-primary underline">{lead.referrer.name}</Link>
                  : <span className="text-sm">{lead.referred_by}</span>}
              </Card>
            )}
            <LeadConnectionsCard leadId={lead.id} company={lead.company} propertyAddress={lead.property_address} />
            <LeadLineageCard leadId={lead.id} clientId={lead.client_id} />
          </div>

          {/* RIGHT — chat-style discussion */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Discussion</p>
              <BdActivityThread
                filter={{ leadId: lead.id }}
                emptyText="No activity yet — start the conversation."
              />
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function LeadLineageCard({ leadId, clientId }: { leadId: string; clientId: string | null }) {
  const { data } = useQuery({
    queryKey: ["lead-lineage", leadId],
    queryFn: async () => {
      const { data: prop } = await supabase
        .from("proposals")
        .select("id, proposal_number, title, converted_project_id, client_id, clients:client_id (id, name)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let project: { id: string; project_number: string | null; name: string | null } | null = null;
      if ((prop as any)?.converted_project_id) {
        const { data: pr } = await supabase
          .from("projects")
          .select("id, project_number, name")
          .eq("id", (prop as any).converted_project_id)
          .maybeSingle();
        project = pr as any;
      }
      return { proposal: prop as any, project };
    },
  });

  const client = (data?.proposal?.clients as any) || (clientId ? { id: clientId, name: null } : null);
  if (!client && !data?.proposal && !data?.project) return null;

  return (
    <Card className="p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lineage</p>
      <LineageBreadcrumb
        prefix="Linked"
        client={client}
        proposal={data?.proposal ? { id: data.proposal.id, proposal_number: data.proposal.proposal_number, title: data.proposal.title } : null}
        project={data?.project}
      />
    </Card>
  );
}
