import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Loader2, MapPin, ExternalLink, Plus, Check, X, Users, Trash2,
} from "lucide-react";
import {
  useBdEvent, useUpdateBdEvent, useDeleteBdEvent,
  useEventAttendees, useAddEventAttendee, useUpdateEventAttendee, useRemoveEventAttendee,
  useMemberships, type EventStatus, type BdEvent,
} from "@/hooks/useBdEvents";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { initials } from "@/components/bd/leadConstants";
import { BdActivityThread } from "@/components/bd/BdActivityThread";
import { EventPrepPanel } from "@/components/bd/EventPrepPanel";

const STATUS_META: Record<EventStatus, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: "Pending", className: "bg-gray-100 text-gray-700 border-gray-200" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700 border-blue-200" },
  REGISTERED: { label: "Registered", className: "bg-purple-100 text-purple-700 border-purple-200" },
  ATTENDED: { label: "Attended", className: "bg-green-100 text-green-700 border-green-200" },
  SKIPPED: { label: "Skipped", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
};

const PRIORITY_OPTIONS = [
  { value: "GO", label: "Go" },
  { value: "DISCUSS", label: "Discuss" },
  { value: "SKIP", label: "Skip" },
];

const PRICE_VERIFIED_OPTIONS = [
  { value: "VERIFIED", label: "Verified" },
  { value: "ESTIMATED", label: "Estimated" },
  { value: "UNKNOWN", label: "Unknown" },
];

/** Click-to-edit input; saves on blur. */
function EditableText({
  value, onSave, placeholder = "—", multiline = false, className = "",
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    const onBlur = () => {
      setEditing(false);
      const next = draft.trim();
      if (next !== (value ?? "")) onSave(next || null);
    };
    return multiline ? (
      <Textarea
        autoFocus rows={3} className={className}
        value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={onBlur}
      />
    ) : (
      <Input
        autoFocus className={`h-8 ${className}`}
        value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Enter" && !multiline) (e.target as HTMLInputElement).blur(); }}
      />
    );
  }
  return (
    <button
      className={`text-left text-sm hover:bg-muted/50 rounded px-1 -mx-1 w-full ${className}`}
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
    >
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-start py-1.5">
      <span className="text-xs text-muted-foreground pt-1">{label}</span>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

export default function BdEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: event, isLoading } = useBdEvent(id);
  const update = useUpdateBdEvent();
  const del = useDeleteBdEvent();
  const memberships = useMemberships();
  const profiles = useCompanyProfiles();
  const attendees = useEventAttendees(id);
  const addAtt = useAddEventAttendee();
  const updAtt = useUpdateEventAttendee();
  const rmAtt = useRemoveEventAttendee();
  const [pickUser, setPickUser] = useState("");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppLayout>
    );
  }
  if (!event || !id) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Event not found. <Link to="/bd/events" className="text-primary underline">Back to Events</Link>
        </div>
      </AppLayout>
    );
  }

  const set = (updates: Partial<BdEvent>) =>
    update.mutate({ id: event.id, ...updates } as any);

  const setIntel = (key: string, value: string | null) => {
    const next = { ...(event.intel ?? {}), [key]: value || undefined };
    if (next[key] === undefined) delete next[key];
    set({ intel: next as any });
  };
  const intel = (event.intel ?? {}) as Record<string, string | undefined>;

  const presentIds = new Set((attendees.data ?? []).map((a) => a.user_id));
  const available = (profiles.data ?? []).filter((p) => !presentIds.has(p.id));

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/bd/events")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Events
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive"
            onClick={() => {
              if (confirm("Delete this event?")) {
                del.mutate(event.id, {
                  onSuccess: () => { toast({ title: "Event deleted" }); navigate("/bd/events"); },
                });
              }
            }}>
            <Trash2 className="h-4 w-4 mr-1.5" />Delete
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <EditableText value={event.name} onSave={(v) => v && set({ name: v })} />
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-sm text-muted-foreground">
            {event.start_date && (
              <span>{format(new Date(event.start_date + "T12:00:00"), "MMM d, yyyy")}</span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1">
                · <MapPin className="h-3 w-3" />{event.location}
              </span>
            )}
            <Select value={event.status} onValueChange={(v) => set({ status: v as EventStatus })}>
              <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0">
                <Badge variant="outline" className={STATUS_META[event.status].className}>
                  {STATUS_META[event.status].label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as EventStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {event.source_url && (
              <a href={event.source_url} target="_blank" rel="noreferrer"
                className="text-xs underline inline-flex items-center gap-1">
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Schedule & Logistics
              </p>
              <Field label="Start date">
                <Input type="date" className="h-8" value={event.start_date ?? ""}
                  onChange={(e) => set({ start_date: e.target.value || null })} />
              </Field>
              <Field label="End date">
                <Input type="date" className="h-8" value={event.end_date ?? ""}
                  onChange={(e) => set({ end_date: e.target.value || null })} />
              </Field>
              <Field label="Location">
                <EditableText value={event.location} onSave={(v) => set({ location: v })} />
              </Field>
              <Field label="Source URL">
                <EditableText value={event.source_url} onSave={(v) => set({ source_url: v })} placeholder="https://…" />
              </Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Classification
              </p>
              <Field label="Event type">
                <EditableText value={event.event_type ?? null}
                  onSave={(v) => set({ event_type: v } as any)}
                  placeholder="e.g. Conference, Mixer, Panel" />
              </Field>
              <Field label="Target audience">
                <EditableText value={event.target_audience ?? null}
                  onSave={(v) => set({ target_audience: v } as any)}
                  placeholder="e.g. Architects + GCs, Owners" />
              </Field>
              <Field label="Category">
                <EditableText value={event.category}
                  onSave={(v) => set({ category: v })} placeholder="e.g. Conference" />
              </Field>
              <Field label="Priority">
                <Select value={event.priority ?? "DISCUSS"}
                  onValueChange={(v) => set({ priority: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) =>
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Next action">
                <EditableText value={event.next_action}
                  onSave={(v) => set({ next_action: v })}
                  placeholder="What's the next step?" />
              </Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Cost
              </p>
              <Field label="Member price">
                <Input type="number" className="h-8" value={event.cost_member ?? ""}
                  onChange={(e) => set({ cost_member: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Non-member">
                <Input type="number" className="h-8" value={event.cost_nonmember ?? ""}
                  onChange={(e) => set({ cost_nonmember: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Actual paid">
                <Input type="number" className="h-8" value={event.cost_actual ?? ""}
                  onChange={(e) => set({ cost_actual: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Paid by">
                <Select
                  value={event.paid_by_user_id ?? "__none"}
                  onValueChange={(v) => set({ paid_by_user_id: v === "__none" ? null : v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {(profiles.data ?? []).map((p: any) =>
                      <SelectItem key={p.id} value={p.id}>
                        {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Price verified">
                <Select value={event.price_verified ?? "UNKNOWN"}
                  onValueChange={(v) => set({ price_verified: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRICE_VERIFIED_OPTIONS.map((o) =>
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Included in membership">
                <div className="flex items-center gap-2 pt-1.5">
                  <input type="checkbox" checked={!!event.included_in_membership}
                    onChange={(e) => set({
                      included_in_membership: e.target.checked,
                      ...(e.target.checked ? {} : { membership_id: null }),
                    } as any)} />
                  <Select
                    value={event.membership_id ?? "__none"}
                    onValueChange={(v) => set({ membership_id: v === "__none" ? null : v })}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Linked membership" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {(memberships.data ?? []).map((m) =>
                        <SelectItem key={m.id} value={m.id}>{m.organization}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Strategy
              </p>
              <Field label="Why it matters">
                <EditableText value={event.why_it_matters ?? null}
                  onSave={(v) => set({ why_it_matters: v } as any)}
                  multiline
                  placeholder="Why is this event worth our time?" />
              </Field>
              <Field label="Recent news">
                <EditableText value={intel.recent_news ?? null}
                  onSave={(v) => setIntel("recent_news", v)}
                  multiline placeholder="What's in the news around this event?" />
              </Field>
              <Field label="Key attendees">
                <EditableText value={intel.key_attendees ?? null}
                  onSave={(v) => setIntel("key_attendees", v)}
                  multiline placeholder="Who specifically should we talk to?" />
              </Field>
              <Field label="Competitive">
                <EditableText value={intel.competitive_landscape ?? null}
                  onSave={(v) => setIntel("competitive_landscape", v)}
                  multiline placeholder="Who else is there competing for the same work?" />
              </Field>
              <Field label="Notes">
                <EditableText value={event.notes} onSave={(v) => set({ notes: v })}
                  multiline placeholder="Anything else…" />
              </Field>
            </Card>

            {/* Attendees */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />Attendees
                </p>
              </div>
              <div className="flex gap-2 mb-3">
                <Select value={pickUser} onValueChange={setPickUser}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Add teammate…" /></SelectTrigger>
                  <SelectContent>
                    {available.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!pickUser}
                  onClick={() => { addAtt.mutate({ event_id: event.id, user_id: pickUser }); setPickUser(""); }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {(attendees.data ?? []).map((a) => {
                  const name = [a.user?.first_name, a.user?.last_name].filter(Boolean).join(" ") || "Unknown";
                  return (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials(name)}</AvatarFallback></Avatar>
                        <span className="text-sm">{name}</span>
                        {a.attended && <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">Attended</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          title="Toggle attended"
                          onClick={() => updAtt.mutate({ id: a.id, event_id: event.id, attended: !a.attended })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => rmAtt.mutate({ id: a.id, event_id: event.id })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {(attendees.data ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No attendees yet.</p>
                )}
              </div>
            </Card>

            <EventPrepPanel
              eventId={event.id}
              category={event.category}
              targetAudience={event.target_audience ?? null}
            />
          </div>

          {/* RIGHT — discussion */}
          <div className="lg:col-span-2 space-y-3">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Discussion
              </p>
              <BdActivityThread
                filter={{ eventId: event.id }}
                emptyText="No discussion yet — start a thread for this event."
              />
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
