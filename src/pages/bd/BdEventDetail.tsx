import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format, parse } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Loader2, MapPin, ExternalLink, Users, Trash2,
  Sparkles, CalendarPlus, ChevronDown, ChevronRight,
} from "lucide-react";

import {
  useBdEvent, useUpdateBdEvent, useDeleteBdEvent,
  type EventStatus, type BdEvent,
} from "@/hooks/useBdEvents";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { BdActivityThread } from "@/components/bd/BdActivityThread";
import { EventPrepPanel } from "@/components/bd/EventPrepPanel";
import { EventApprovalActions } from "@/components/bd/EventApprovalActions";
import { EventTasksCard } from "@/components/bd/EventTasksCard";
import { AttendeesPicker } from "@/components/bd/AttendeesPicker";
import { supabase } from "@/integrations/supabase/client";

function icsEscape(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function toIcsDate(date: string) {
  return date.replace(/-/g, "");
}
function addOneDay(date: string) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function toIcsDateTime(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.replace(/:/g, "").slice(0, 6).padEnd(6, "0")}`;
}
function formatEventTime(start: string | null, end: string | null) {
  if (!start && !end) return null;
  const fmt = (value: string) => format(parse(value.slice(0, 5), "HH:mm", new Date()), "h:mm a");
  return [start ? fmt(start) : null, end ? fmt(end) : null].filter(Boolean).join("–");
}
function formatNotes(value: string | null) {
  return value?.split("|").map((part) => part.trim()).filter(Boolean).join("\n") ?? null;
}
function downloadEventIcs(event: BdEvent) {
  if (!event.start_date) {
    alert("Add a date before exporting to calendar.");
    return;
  }
  const hasTime = !!event.start_time;
  const dtStart = hasTime ? toIcsDateTime(event.start_date, event.start_time as string) : toIcsDate(event.start_date);
  const dtEnd = hasTime
    ? toIcsDateTime(event.end_date || event.start_date, event.end_time || event.start_time as string)
    : toIcsDate(addOneDay(event.end_date || event.start_date));
  const uid = `${event.id}@ordino`;
  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ordino//BD Events//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    hasTime ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    hasTime ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${icsEscape(event.name)}`,
    event.location ? `LOCATION:${icsEscape(event.location)}` : "",
    event.notes ? `DESCRIPTION:${icsEscape(event.notes)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.name.replace(/[^a-z0-9]+/gi, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


const STATUS_META: Record<EventStatus, { label: string; className: string }> = {
  SUGGESTED: { label: "AI Suggested", className: "bg-amber-50 text-amber-800 border-amber-200" },
  PENDING_APPROVAL: { label: "Pending", className: "bg-gray-100 text-gray-700 border-gray-200" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700 border-blue-200" },
  REGISTERED: { label: "Registered", className: "bg-purple-100 text-purple-700 border-purple-200" },
  ATTENDED: { label: "Attended", className: "bg-green-100 text-green-700 border-green-200" },
  SKIPPED: { label: "Skipped", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  DISMISSED: { label: "Dismissed", className: "bg-gray-50 text-gray-500 border-gray-200" },
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
      className={`text-left text-sm hover:bg-muted/50 rounded px-1 -mx-1 w-full ${multiline ? "whitespace-pre-wrap" : ""} ${className}`}
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
  const profiles = useCompanyProfiles();
  const [isDrafting, setIsDrafting] = useState(false);
  const [showResearch, setShowResearch] = useState(false);


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

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/bd/events")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Events
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => downloadEventIcs(event)}>
              <CalendarPlus className="h-4 w-4 mr-1.5" />Export to Calendar
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
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <EditableText value={event.name} onSave={(v) => v && set({ name: v })} />
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-sm text-muted-foreground">
            {event.start_date && (
              <span>
                {format(new Date(event.start_date + "T12:00:00"), "EEE, MMM d, yyyy")}
              </span>
            )}
            {formatEventTime(event.start_time, event.end_time) && (
              <span>· {formatEventTime(event.start_time, event.end_time)}</span>
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

        {event.status === "SUGGESTED" && (
          <Card className="p-4 border-amber-300 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">AI suggested this event</p>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  {event.why_it_matters || "Review the strategy below and decide whether to add it to the pipeline."}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline"
                  onClick={() => set({ status: "DISMISSED" })}>
                  Dismiss
                </Button>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => set({ status: "PENDING_APPROVAL" })}>
                  Add to pipeline
                </Button>
              </div>
            </div>
          </Card>
        )}

        <EventApprovalActions event={event} />


        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Schedule & Logistics
              </p>
              <Field label="Date">
                <Input type="date" className="h-8" value={event.start_date ?? ""}
                  onChange={(e) => set({ start_date: e.target.value || null, end_date: e.target.value || null } as any)} />
              </Field>
              <Field label="Start time">
                <Input type="time" className="h-8" value={event.start_time?.slice(0, 5) ?? ""}
                  onChange={(e) => set({ start_time: e.target.value || null } as any)} />
              </Field>
              <Field label="End time">
                <Input type="time" className="h-8" value={event.end_time?.slice(0, 5) ?? ""}
                  onChange={(e) => set({ end_time: e.target.value || null } as any)} />
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
            </Card>

            <Card className="p-4 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Strategy
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isDrafting}
                  onClick={async () => {
                    const hasAny =
                      (event.why_it_matters ?? "").trim() ||
                      (intel.recent_news ?? "").trim() ||
                      (intel.key_attendees ?? "").trim() ||
                      (intel.competitive_landscape ?? "").trim();
                    if (hasAny && !confirm("Overwrite existing Strategy fields with AI draft?")) return;
                    setIsDrafting(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("draft-event-strategy", {
                        body: {
                          event_name: event.name,
                          source_url: (event.intel as any)?.source_url ?? event.source_url,
                          category: event.category,
                          target_audience: event.target_audience,
                          why_it_matters: event.why_it_matters,
                        },
                      });
                      if (error) throw error;
                      const d = data as any;
                      const nextIntel = {
                        ...(event.intel ?? {}),
                        recent_news: d.recent_news ?? intel.recent_news,
                        key_attendees: d.key_attendees ?? intel.key_attendees,
                        competitive_landscape: d.competitive_landscape ?? intel.competitive_landscape,
                      };
                      set({
                        why_it_matters: d.why_it_matters ?? event.why_it_matters,
                        intel: nextIntel as any,
                      } as any);
                      toast({ title: "AI strategy drafted" });
                    } catch (e: any) {
                      toast({
                        title: "AI draft failed",
                        description: e?.message ?? "Try again in a moment.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsDrafting(false);
                    }
                  }}
                >
                  {isDrafting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Draft strategy with AI
                </Button>
              </div>
              <Field label="Why it matters">
                <EditableText value={event.why_it_matters ?? null}
                  onSave={(v) => set({ why_it_matters: v } as any)}
                  multiline
                  placeholder="Why is this event worth our time?" />
              </Field>
              <Field label="Notes">
                <EditableText value={formatNotes(event.notes)} onSave={(v) => set({ notes: v })}
                  multiline placeholder="Anything else…" />
              </Field>
              <button
                type="button"
                onClick={() => setShowResearch((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showResearch ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {showResearch ? "Hide research" : "Show research"}
              </button>
              {showResearch && (
                <div className="mt-1">
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
                </div>
              )}
            </Card>


            {/* Attendees */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />Attendees
                </p>
              </div>
              <AttendeesPicker eventId={event.id} />
            </Card>

            <EventPrepPanel
              eventId={event.id}
              category={event.category}
              targetAudience={event.target_audience ?? null}
            />

            <EventTasksCard eventId={event.id} />
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
