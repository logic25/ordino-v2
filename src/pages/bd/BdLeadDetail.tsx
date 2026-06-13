import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Flame, Loader2, Pencil, FilePlus2, Trophy, Ban, CalendarClock, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useLead, useUpdateLead, type LeadStage } from "@/hooks/useLeads";
import { useConvertLeadToProposal } from "@/hooks/useLeadConversion";
import { LineageBreadcrumb } from "@/components/shared/LineageBreadcrumb";
import { LeadConnectionsCard } from "@/components/bd/LeadConnectionsCard";
import { LeadStageStepper } from "@/components/bd/LeadStageStepper";
import { BdActivityThread } from "@/components/bd/BdActivityThread";
import { useBdActivities } from "@/hooks/useBdActivities";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import {
  STAGE_META, SOURCE_META, TIMELINE_LABELS, stageRank, profileLabel,
} from "@/components/bd/leadConstants";

const CLIENT_TYPES = [
  "homeowner", "property_manager", "contractor", "architect",
  "developer", "management_company", "government", "other",
];

/** Suggest a likely organization name from a government-style role title. */
function suggestCompanyFromRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const r = role.trim();
  if (!r) return null;
  const govPatterns = [
    /borough president/i, /council member/i, /councilmember/i, /commissioner/i,
    /comptroller/i, /public advocate/i, /assembly member/i, /assemblymember/i,
    /state senator/i, /senator/i, /district leader/i, /community board/i,
    /mayor/i, /deputy mayor/i, /chief of staff/i, /director of/i,
  ];
  if (govPatterns.some((p) => p.test(r))) return `Office of the ${r}`;
  return null;
}

/** Click-to-edit text field. Saves on blur or Enter. Inline, no per-field button. */
function EditableText({
  value, onSave, placeholder = "Add value", forceEdit = false, multiline = false,
}: {
  value: string | null;
  onSave: (v: string) => void;
  placeholder?: string;
  forceEdit?: boolean;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const isEditing = editing || forceEdit;

  if (isEditing) {
    const commit = () => {
      setEditing(false);
      if (draft !== (value ?? "")) onSave(draft);
    };
    return multiline ? (
      <textarea
        autoFocus={editing}
        rows={3}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 resize-y"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    ) : (
      <Input
        autoFocus={editing}
        className="h-9 border-slate-300 focus-visible:ring-amber-500"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
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
      className="group flex w-full items-center justify-between gap-2 rounded px-1.5 -mx-1.5 py-1 text-left text-sm hover:bg-slate-100 transition-colors"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
    >
      <span className={cn("truncate text-sm text-slate-900", empty && "text-slate-400 italic")}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

/** Two-column inline field row used inside each section. */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 items-start py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 pt-1.5">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Section block with an editorial eyebrow heading. */
function Section({
  eyebrow, children, className,
}: { eyebrow: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bd-surface rounded-xl p-6", className)}>
      <h3 className="bd-eyebrow mb-4">{eyebrow}</h3>
      {children}
    </section>
  );
}

export default function BdLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const { data: profiles = [] } = useAssignableProfiles();
  const { data: activities = [] } = useBdActivities({ leadId: id });
  const update = useUpdateLead();
  useConvertLeadToProposal(); // hook still warmed for downstream
  const [editAll, setEditAll] = useState(false);

  const commsCounts = activities.reduce(
    (acc, a) => {
      if (a.type === "EMAIL") acc.email++;
      else if (a.type === "CALL") acc.call++;
      else if (a.type === "MEETING") acc.meeting++;
      acc.total++;
      return acc;
    },
    { email: 0, call: 0, meeting: 0, total: 0 },
  );
  const lastActivity = activities[0];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="bd-scope flex h-64 items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppLayout>
    );
  }
  if (!lead) {
    return (
      <AppLayout>
        <div className="bd-scope p-8 text-center text-slate-500">
          Lead not found.{" "}
          <Link to="/bd/leads" className="text-amber-600 underline">Back to Leads</Link>
        </div>
      </AppLayout>
    );
  }

  const set = (updates: Record<string, any>) => update.mutate({ id: lead.id, ...updates });
  const stageMeta = lead.stage ? STAGE_META[lead.stage] : null;
  const canCreateProposal = stageRank(lead.stage) >= stageRank("QUALIFIED");
  const showWonLost = lead.stage === "PROPOSAL";

  const handleCreateProposal = () => {
    const params = new URLSearchParams();
    if (lead.property_address) params.set("address", lead.property_address);
    params.set("leadId", lead.id);
    navigate(`/proposals?${params.toString()}`);
  };

  const SourceIcon = lead.source_type ? SOURCE_META[lead.source_type].icon : null;

  return (
    <AppLayout>
      <div className="bd-scope min-h-screen -m-6 p-6 md:p-10 animate-fade-in">
        <div className="max-w-[1280px] mx-auto space-y-6">
          {/* ─── Sticky Header ───────────────────────────────────────── */}
          <header className="sticky top-0 z-10 -mx-6 md:-mx-10 px-6 md:px-10 py-5 bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/bd/leads")}
              className="text-slate-600 hover:bg-slate-100 -ml-2 mb-3"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Leads
            </Button>

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 truncate tracking-tight">
                  {lead.full_name}
                </h1>
                {lead.company && (
                  <p className="text-base text-slate-500 mt-1 truncate">
                    {lead.company}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {stageMeta && (
                    <Badge variant="outline" className={cn("rounded-full text-xs font-medium", stageMeta.className)}>
                      {stageMeta.label}
                    </Badge>
                  )}
                  {SourceIcon && lead.source_type && (
                    <Badge variant="secondary" className="rounded-full gap-1 bg-slate-100 text-slate-700 border-0 text-xs font-medium">
                      <SourceIcon className="h-3 w-3" /> {SOURCE_META[lead.source_type].label}
                    </Badge>
                  )}
                  {lead.client_type && (
                    <Badge variant="outline" className="rounded-full text-xs font-medium border-slate-200 text-slate-600">
                      {lead.client_type.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <button
                    onClick={() => set({ hot_opportunity: !lead.hot_opportunity })}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Toggle hot"
                  >
                    <Flame className={cn("h-3 w-3", lead.hot_opportunity ? "text-orange-500 fill-orange-500" : "text-slate-400")} />
                    {lead.hot_opportunity ? "Hot" : "Mark hot"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditAll((v) => !v)}
                  className="rounded-full border-slate-200 hover:bg-slate-100"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {editAll ? "Done editing" : "Edit details"}
                </Button>
                {canCreateProposal && (
                  <Button
                    size="sm"
                    onClick={handleCreateProposal}
                    className="rounded-full bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    <FilePlus2 className="mr-1.5 h-4 w-4" /> Create Proposal
                  </Button>
                )}
                {showWonLost && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => set({ stage: "WON" as LeadStage })}
                      className="rounded-full bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    >
                      <Trophy className="mr-1.5 h-3.5 w-3.5" /> Won
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => set({ stage: "LOST" as LeadStage })}
                      className="rounded-full bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" /> Lost
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Stage stepper */}
            <div className="mt-6">
              <LeadStageStepper current={lead.stage} onChange={(s) => set({ stage: s })} />
            </div>
          </header>

          {/* ─── Main Grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* MAIN (col-span 8) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Primary Identity */}
              <Section eyebrow="Primary Identity">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <FieldRow label="Name">
                    <EditableText value={lead.full_name} onSave={(v) => set({ full_name: v })} placeholder="Add name" forceEdit={editAll} />
                  </FieldRow>
                  <FieldRow label="Role">
                    <EditableText value={lead.role} onSave={(v) => set({ role: v })} placeholder="Add role" forceEdit={editAll} />
                  </FieldRow>
                  <FieldRow label="Company">
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
                          className="text-[11px] text-amber-700 hover:underline pl-1.5"
                        >
                          Use suggested: "{suggestCompanyFromRole(lead.role)}"
                        </button>
                      )}
                    </div>
                  </FieldRow>
                  <FieldRow label="Client type">
                    <Select
                      value={lead.client_type ?? undefined}
                      onValueChange={(v) => set({ client_type: v })}
                    >
                      <SelectTrigger className="h-8 border-amber-200/60">
                        <SelectValue placeholder="Set client type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Email">
                    <EditableText value={lead.contact_email} onSave={(v) => set({ contact_email: v })} placeholder="Add email" forceEdit={editAll} />
                  </FieldRow>
                  <FieldRow label="Phone">
                    <EditableText value={lead.contact_phone} onSave={(v) => set({ contact_phone: v })} placeholder="Add phone" forceEdit={editAll} />
                  </FieldRow>
                </div>
                <div className="mt-2">
                  <FieldRow label="Address">
                    <EditableText
                      value={(lead as any).contact_address ?? null}
                      onSave={(v) => set({ contact_address: v } as any)}
                      placeholder="Add mailing / office address"
                      forceEdit={editAll}
                    />
                  </FieldRow>
                </div>

                {/* Where we met + Communications summary */}
                <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">Where we met</p>
                    <p className="text-sm text-slate-900">
                      {lead.source_type ? SOURCE_META[lead.source_type].label : "Source not specified"}
                      {lead.event?.name && <> · <Link to="/bd/events" className="text-amber-600 hover:underline">{lead.event.name}</Link></>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      First contact {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      {lead.event?.start_date && <> · Event {format(new Date(lead.event.start_date), "MMM d, yyyy")}</>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">Communications</p>
                    {commsCounts.total === 0 ? (
                      <p className="text-sm text-slate-400 italic">No activity logged yet</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-900">
                          {commsCounts.email} {commsCounts.email === 1 ? "email" : "emails"} ·{" "}
                          {commsCounts.call} {commsCounts.call === 1 ? "call" : "calls"} ·{" "}
                          {commsCounts.meeting} {commsCounts.meeting === 1 ? "meeting" : "meetings"}
                        </p>
                        {lastActivity && (
                          <p className="text-xs text-slate-500 mt-1">
                            Last activity {formatDistanceToNow(new Date(lastActivity.created_at), { addSuffix: true })}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Section>

              {/* Project Details */}
              <Section eyebrow="Project Details">
                <FieldRow label="Opportunity">
                  <EditableText value={lead.subject} onSave={(v) => set({ subject: v })} placeholder="What's the work? (e.g. Façade LL11, New Building)" forceEdit={editAll} />
                </FieldRow>
                <FieldRow label="Property">
                  <EditableText value={lead.property_address} onSave={(v) => set({ property_address: v })} placeholder="Add address" forceEdit={editAll} />
                </FieldRow>
                {(lead.architect_name || editAll) && (
                  <FieldRow label="Architect">
                    <EditableText value={lead.architect_name} onSave={(v) => set({ architect_name: v })} placeholder="Add architect" forceEdit={editAll} />
                  </FieldRow>
                )}
                {(lead.gc_name || editAll) && (
                  <FieldRow label="GC">
                    <EditableText value={lead.gc_name} onSave={(v) => set({ gc_name: v })} placeholder="Add GC" forceEdit={editAll} />
                  </FieldRow>
                )}
              </Section>

              {/* Qualification */}
              <Section eyebrow="Qualification">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Timeline</p>
                    <Select
                      value={lead.project_timeline ?? undefined}
                      onValueChange={(v) => set({ project_timeline: v })}
                    >
                      <SelectTrigger className="h-9 border-amber-200/60">
                        <SelectValue placeholder="Set timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIMELINE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Expected value</p>
                    <div className="bd-display text-2xl font-bold text-slate-900">
                      <EditableText
                        value={lead.expected_value != null ? `$${Number(lead.expected_value).toLocaleString()}` : null}
                        onSave={(v) => {
                          const clean = v.replace(/[^0-9.]/g, "");
                          set({ expected_value: clean ? Number(clean) : null });
                        }}
                        placeholder="Add value"
                        forceEdit={editAll}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Owner</p>
                    <Select
                      value={lead.assigned_to ?? undefined}
                      onValueChange={(v) => set({ assigned_to: v })}
                    >
                      <SelectTrigger className="h-9 border-amber-200/60">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t bd-hairline">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Notes</p>
                  <EditableText
                    value={(lead as any).notes ?? null}
                    onSave={(v) => set({ notes: v })}
                    placeholder="Add a note about this lead…"
                    forceEdit={editAll}
                    multiline
                  />
                </div>
              </Section>

              {/* Next Follow-up — amber accent card (v2 style) */}
              <section className="rounded-xl p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_8px_24px_-12px_rgba(217,119,6,0.5)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-50/80 flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" /> Next Follow-up
                  </h3>
                  {(lead.next_follow_up_at || lead.follow_up_note) && (
                    <button
                      onClick={() => set({ next_follow_up_at: null, follow_up_note: null })}
                      className="text-[11px] uppercase font-bold tracking-wider text-amber-50/80 hover:text-white inline-flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Note — e.g. discuss Hudson Yards permit timeline"
                    defaultValue={lead.follow_up_note ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      if (v !== (lead.follow_up_note ?? null)) set({ follow_up_note: v });
                    }}
                    className="w-full bg-transparent border-0 border-b border-amber-200/40 px-0 py-1 text-lg font-medium placeholder:text-amber-100/60 focus:outline-none focus:border-white bd-display"
                    key={`n-${lead.id}-${lead.follow_up_note ?? ""}`}
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      defaultValue={lead.next_follow_up_at ?? ""}
                      onChange={(e) => set({ next_follow_up_at: e.target.value || null })}
                      className="h-8 rounded-md bg-white/15 border border-white/20 px-2 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-white/60"
                      key={`d-${lead.id}-${lead.next_follow_up_at ?? ""}`}
                    />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-amber-50/70">
                      Personal reminder — shows in BD → Follow-ups
                    </span>
                  </div>
                </div>
              </section>

              {/* Source */}
              <Section eyebrow="Acquisition Source">
                {lead.source_type === "EVENT" && lead.event ? (
                  <Link
                    to="/bd/events"
                    className="block group"
                  >
                    <p className="bd-display text-lg font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                      {lead.event.name}
                    </p>
                    {lead.event.start_date && (
                      <p className="text-sm text-slate-500 mt-0.5">
                        {format(new Date(lead.event.start_date), "MMMM d, yyyy")}
                      </p>
                    )}
                  </Link>
                ) : lead.source_type === "REFERRAL" && (lead.referrer || lead.referred_by) ? (
                  <div>
                    <p className="bd-display text-lg font-semibold text-slate-900">
                      {lead.referrer ? (
                        <Link to="/clients" className="hover:text-amber-700">{lead.referrer.name}</Link>
                      ) : (
                        lead.referred_by
                      )}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">Referral</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    {SourceIcon && <SourceIcon className="h-4 w-4 text-amber-700" />}
                    <span>
                      {lead.source_type
                        ? SOURCE_META[lead.source_type].label
                        : "Source not specified"}
                    </span>
                  </div>
                )}
              </Section>

              {/* Connections */}
              <div className="bd-surface rounded-xl">
                <LeadConnectionsCard
                  leadId={lead.id}
                  company={lead.company}
                  propertyAddress={lead.property_address}
                />
              </div>

              {/* Lineage */}
              <LeadLineageCard leadId={lead.id} clientId={lead.client_id} />
            </div>

            {/* ASIDE (col-span 4) — Activity */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-[260px] bd-surface rounded-xl p-5 flex flex-col">
                <h3 className="bd-eyebrow mb-3">Activity</h3>
                <BdActivityThread
                  filter={{ leadId: lead.id }}
                  emptyText="No activity yet — start the conversation."
                />
              </div>
            </aside>
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
    <section className="bd-surface rounded-xl p-6">
      <h3 className="bd-eyebrow mb-3">Lineage</h3>
      <LineageBreadcrumb
        prefix="Linked"
        client={client}
        proposal={data?.proposal ? { id: data.proposal.id, proposal_number: data.proposal.proposal_number, title: data.proposal.title } : null}
        project={data?.project}
      />
    </section>
  );
}
