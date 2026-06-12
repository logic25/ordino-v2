import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Flame, Loader2, StickyNote, Phone, Users, ArrowRight, Info,
  FileText, Mail, Pin, PinOff, FilePlus2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useLead, useUpdateLead, type LeadStage } from "@/hooks/useLeads";
import {
  useLeadActivities, useCreateLeadActivity, useToggleActivityPin, type ActivityType,
} from "@/hooks/useLeadActivities";
import { useConvertLeadToProposal } from "@/hooks/useLeadConversion";
import { LineageBreadcrumb } from "@/components/shared/LineageBreadcrumb";
import { LeadConnectionsCard } from "@/components/bd/LeadConnectionsCard";
import { useQuery } from "@tanstack/react-query";

import {
  STAGE_META, STAGE_ORDER, SOURCE_META, TIMELINE_LABELS, stageRank, profileLabel, initials,
} from "@/components/bd/leadConstants";

const ACTIVITY_ICON: Record<ActivityType, typeof StickyNote> = {
  NOTE: StickyNote, CALL: Phone, MEETING: Users, STAGE_CHANGE: ArrowRight,
  STATUS_CHANGE: ArrowRight, SYSTEM: Info, PROPOSAL_CREATED: FileText, EMAIL: Mail,
  APPROVAL: Info,
};

const CLIENT_TYPES = [
  "homeowner", "property_manager", "contractor", "architect",
  "developer", "management_company", "government", "other",
];

/** Click-to-edit text field, saves on blur. */
function EditableText({
  value, onSave, placeholder = "—", className = "",
}: { value: string | null; onSave: (v: string) => void; placeholder?: string; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <Input
        autoFocus
        className={`h-8 ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== (value ?? "")) onSave(draft); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    );
  }
  return (
    <button className={`text-left text-sm hover:bg-muted/50 rounded px-1 -mx-1 ${className}`}
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
      {value || <span className="text-muted-foreground">{placeholder}</span>}
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

  const { data: activities = [] } = useLeadActivities(id);
  const createActivity = useCreateLeadActivity();
  const togglePin = useToggleActivityPin();

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);

  if (isLoading) {
    return <AppLayout><div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div></AppLayout>;
  }
  if (!lead) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Lead not found. <Link to="/bd/leads" className="text-primary underline">Back to Leads</Link></div></AppLayout>;
  }

  const set = (updates: Record<string, any>) => update.mutate({ id: lead.id, ...updates });
  const stageMeta = lead.stage ? STAGE_META[lead.stage] : null;
  const ownerProfile = profiles.find((p: any) => p.id === lead.assigned_to);
  const canCreateProposal = stageRank(lead.stage) >= stageRank("QUALIFIED");

  const advanceStage = () => {
    if (!lead.stage) return set({ stage: "CONTACTED" });
    const idx = STAGE_ORDER.indexOf(lead.stage);
    const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
    if (next !== lead.stage) set({ stage: next });
  };

  const handleCreateProposal = async () => {
    setCreatingProposal(true);
    try {
      const proposalId = await convert.mutateAsync({ lead });
      // Record the proposal creation in the activity thread (lead.client_id /
      // stage / proposal_id are already updated atomically by the RPC).
      await createActivity.mutateAsync({
        lead_id: lead.id,
        type: "PROPOSAL_CREATED",
        content: "Proposal created from lead",
        metadata: { proposal_id: proposalId },
      });
      toast({ title: "Proposal created", description: "Opening Proposals…" });
      navigate("/proposals");
    } catch (e: any) {
      toast({ title: "Could not create proposal", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setCreatingProposal(false);
    }
  };

  // Pinned first, then chronological (query already returns newest-first).
  const pinned = activities.filter((a) => a.is_pinned);
  const rest = activities.filter((a) => !a.is_pinned);

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bd/leads")}><ArrowLeft className="mr-2 h-4 w-4" />Leads</Button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT — data */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{lead.full_name}</h1>
                {lead.company && <p className="text-muted-foreground">{lead.company}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Select value={lead.stage ?? undefined} onValueChange={(v) => set({ stage: v as LeadStage })}>
                    <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0">
                      <Badge variant="outline" className={stageMeta?.className}>{stageMeta?.label ?? "Set stage"}</Badge>
                    </SelectTrigger>
                    <SelectContent>{STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_META[s].label}</SelectItem>)}</SelectContent>
                  </Select>
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
                <Button variant="outline" size="sm" onClick={advanceStage}>Advance stage</Button>
                {canCreateProposal && (
                  <Button size="sm" onClick={handleCreateProposal} disabled={creatingProposal}>
                    {creatingProposal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
                    Create Proposal
                  </Button>
                )}
              </div>
            </div>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Identity</p>
              <Field label="Name"><EditableText value={lead.full_name} onSave={(v) => set({ full_name: v })} /></Field>
              <Field label="Company"><EditableText value={lead.company} onSave={(v) => set({ company: v })} /></Field>
              <Field label="Role"><EditableText value={lead.role} onSave={(v) => set({ role: v })} /></Field>
              <Field label="Email"><EditableText value={lead.contact_email} onSave={(v) => set({ contact_email: v })} /></Field>
              <Field label="Phone"><EditableText value={lead.contact_phone} onSave={(v) => set({ contact_phone: v })} /></Field>
              <Field label="Client type">
                <Select value={lead.client_type ?? undefined} onValueChange={(v) => set({ client_type: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{CLIENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project Details</p>
              <Field label="Subject"><EditableText value={lead.subject} onSave={(v) => set({ subject: v })} /></Field>
              <Field label="Property"><EditableText value={lead.property_address} onSave={(v) => set({ property_address: v })} /></Field>
              <Field label="Architect"><EditableText value={lead.architect_name} onSave={(v) => set({ architect_name: v })} /></Field>
              <Field label="GC"><EditableText value={lead.gc_name} onSave={(v) => set({ gc_name: v })} /></Field>
              <Field label="SIA"><EditableText value={lead.sia_name} onSave={(v) => set({ sia_name: v })} /></Field>
              <Field label="TPP"><EditableText value={lead.tpp_name} onSave={(v) => set({ tpp_name: v })} /></Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Qualification</p>
              <Field label="Timeline">
                <Select value={lead.project_timeline ?? undefined} onValueChange={(v) => set({ project_timeline: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{Object.entries(TIMELINE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Expected value">
                <EditableText value={lead.expected_value != null ? String(lead.expected_value) : null}
                  onSave={(v) => set({ expected_value: v ? Number(v) : null })} placeholder="—" />
              </Field>
              <Field label="Hot">
                <button onClick={() => set({ hot_opportunity: !lead.hot_opportunity })}>
                  <Flame className={`h-4 w-4 ${lead.hot_opportunity ? "text-orange-500 fill-orange-500" : "text-muted-foreground/40"}`} />
                </button>
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
              {ownerProfile && <Field label="Owner name"><span className="text-sm">{profileLabel(ownerProfile)}</span></Field>}
            </Card>

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

          {/* RIGHT — activity thread */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setNoteOpen((o) => !o)}><StickyNote className="mr-1.5 h-3.5 w-3.5" />Add Note</Button>
              <Button size="sm" variant="outline" onClick={() => setCallOpen(true)}><Phone className="mr-1.5 h-3.5 w-3.5" />Log Call</Button>
              <Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)}><Users className="mr-1.5 h-3.5 w-3.5" />Log Meeting</Button>
            </div>

            {noteOpen && (
              <Card className="p-3 space-y-2">
                <Textarea rows={3} placeholder="Write a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setNoteOpen(false); setNoteText(""); }}>Cancel</Button>
                  <Button size="sm" disabled={!noteText.trim()} onClick={async () => {
                    await createActivity.mutateAsync({ lead_id: lead.id, type: "NOTE", content: noteText.trim() });
                    setNoteText(""); setNoteOpen(false);
                  }}>Save</Button>
                </div>
              </Card>
            )}

            {pinned.length > 0 && (
              <div className="space-y-2">
                {pinned.map((a) => <ActivityRow key={a.id} a={a} onPin={() => togglePin.mutate({ id: a.id, lead_id: lead.id, is_pinned: false })} />)}
                <div className="border-t" />
              </div>
            )}
            <div className="space-y-2">
              {rest.length === 0 && pinned.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>}
              {rest.map((a) => <ActivityRow key={a.id} a={a} onPin={() => togglePin.mutate({ id: a.id, lead_id: lead.id, is_pinned: true })} />)}
            </div>
          </div>
        </div>
      </div>

      <LogCallDialog open={callOpen} onOpenChange={setCallOpen} leadId={lead.id} createActivity={createActivity} />
      <LogMeetingDialog open={meetingOpen} onOpenChange={setMeetingOpen} leadId={lead.id} createActivity={createActivity} profiles={profiles} />
    </AppLayout>
  );
}

function ActivityRow({ a, onPin }: { a: any; onPin: () => void }) {
  const Icon = ACTIVITY_ICON[a.type as ActivityType] ?? Info;
  const author = a.author ? (profileLabel(a.author)) : "System";
  return (
    <div className="flex gap-2 group">
      <div className="mt-0.5"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{initials(author)}</AvatarFallback></Avatar>
          <span className="font-medium text-foreground">{author}</span>
          <span>· {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
          <button className="ml-auto opacity-0 group-hover:opacity-100" onClick={onPin} aria-label="Pin">
            {a.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
        </div>
        {a.content && <p className="text-sm whitespace-pre-wrap mt-0.5">{a.content}</p>}
        {a.type === "CALL" && a.metadata?.duration_minutes != null && (
          <p className="text-xs text-muted-foreground">{a.metadata.duration_minutes} min</p>
        )}
      </div>
    </div>
  );
}

function LogCallDialog({ open, onOpenChange, leadId, createActivity }: any) {
  const [duration, setDuration] = useState("");
  const [summary, setSummary] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Call</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm">Duration (minutes)</label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div><label className="text-sm">Summary</label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            await createActivity.mutateAsync({ lead_id: leadId, type: "CALL", content: summary.trim() || null, metadata: { duration_minutes: duration ? Number(duration) : null } });
            setDuration(""); setSummary(""); onOpenChange(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogMeetingDialog({ open, onOpenChange, leadId, createActivity, profiles }: any) {
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [summary, setSummary] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const toggle = (id: string) => setAttendees((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Meeting</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm">Location</label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><label className="text-sm">Duration (minutes)</label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div>
            <label className="text-sm">Attendees</label>
            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
              {profiles.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={attendees.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  {profileLabel(p)}
                </label>
              ))}
            </div>
          </div>
          <div><label className="text-sm">Summary</label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            await createActivity.mutateAsync({
              lead_id: leadId, type: "MEETING", content: summary.trim() || null,
              metadata: { location: location.trim() || null, attendee_ids: attendees, duration_minutes: duration ? Number(duration) : null },
            });
            setLocation(""); setDuration(""); setSummary(""); setAttendees([]); onOpenChange(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
