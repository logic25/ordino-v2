import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, X, Workflow, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useSequences, useEnrollLead, useUpdateEnrollment, useSequenceEnrollments,
  useSequenceSteps,
} from "@/hooks/useBdSequences";
import { InfoTip } from "./InfoTip";

/**
 * Outreach card for a lead — combines:
 *   - Sequence enrollment (automated cadence)
 *   - One-off next-follow-up reminder (ad-hoc)
 */
export function LeadOutreachCard({
  leadId, leadStage, leadKind,
  followUpAt, followUpNote,
  onChangeFollowUp,
}: {
  leadId: string;
  leadStage: string | null;
  leadKind: "PROSPECT" | "CONTACT";
  followUpAt: string | null;
  followUpNote: string | null;
  onChangeFollowUp: (next: { next_follow_up_at?: string | null; follow_up_note?: string | null }) => void;
}) {
  const sequences = useSequences();
  const enrollments = useSequenceEnrollments({ lead_id: leadId });
  const active = enrollments.data?.find((e) => e.status === "ACTIVE" || e.status === "PAUSED");
  const steps = useSequenceSteps(active?.sequence_id);
  const enroll = useEnrollLead();
  const update = useUpdateEnrollment();
  const [pickerOpen, setPickerOpen] = useState(false);

  const showNudge =
    leadKind === "PROSPECT" &&
    !active &&
    !followUpAt &&
    !followUpNote &&
    leadStage && leadStage !== "NEW" && leadStage !== "WON" && leadStage !== "LOST";

  return (
    <section className="rounded-xl p-6 bg-white border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Sequence half ── */}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-1.5 mb-3">
            <Workflow className="h-3.5 w-3.5" /> Sequence
            <InfoTip text="Automated multi-touch outreach cadence. Manage templates in BD → Sequences." />
          </h3>

          {active ? (
            <div className="space-y-2">
              <div>
                <Link to="/bd/sequences" className="text-base font-semibold text-slate-900 hover:text-amber-600">
                  {active.sequence?.name ?? "Sequence"}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">
                  Step {Math.max(active.current_step, 1)} of {steps.data?.length ?? "?"}
                  {active.last_sent_at && ` · Last sent ${new Date(active.last_sent_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {active.status === "ACTIVE" ? (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => update.mutate({ id: active.id, status: "PAUSED" })}>
                    <Pause className="mr-1.5 h-3 w-3" /> Pause
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => update.mutate({ id: active.id, status: "ACTIVE" })}>
                    <Play className="mr-1.5 h-3 w-3" /> Resume
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-slate-500 hover:text-red-600" onClick={() => update.mutate({ id: active.id, status: "STOPPED" })}>
                  <Trash2 className="mr-1.5 h-3 w-3" /> Unenroll
                </Button>
              </div>
            </div>
          ) : pickerOpen ? (
            <Select
              onValueChange={(v) => {
                enroll.mutate({ sequence_id: v, lead_ids: [leadId] });
                setPickerOpen(false);
              }}
            >
              <SelectTrigger className="h-9 border-slate-300">
                <SelectValue placeholder="Choose a sequence…" />
              </SelectTrigger>
              <SelectContent>
                {(sequences.data ?? []).length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-slate-500">
                    No sequences yet. <Link to="/bd/sequences" className="text-amber-600 underline">Create one</Link>.
                  </div>
                )}
                {(sequences.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button size="sm" variant="outline" className="h-9 border-slate-300" onClick={() => setPickerOpen(true)}>
              <Workflow className="mr-1.5 h-3.5 w-3.5" /> Enroll in sequence
            </Button>
          )}
        </div>

        {/* ── Follow-up half ── */}
        <div className="md:border-l md:border-slate-200 md:pl-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Next Follow-up
              <InfoTip text="A one-off personal reminder. Shows in BD → Follow-ups." />
            </h3>
            {(followUpAt || followUpNote) && (
              <button
                onClick={() => onChangeFollowUp({ next_follow_up_at: null, follow_up_note: null })}
                className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Note — e.g. call after their permit hearing"
              defaultValue={followUpNote ?? ""}
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== (followUpNote ?? null)) onChangeFollowUp({ follow_up_note: v });
              }}
              className="w-full bg-transparent border-0 border-b border-slate-200 px-0 py-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              key={`n-${leadId}-${followUpNote ?? ""}`}
            />
            <input
              type="date"
              defaultValue={followUpAt ?? ""}
              onChange={(e) => onChangeFollowUp({ next_follow_up_at: e.target.value || null })}
              className="h-9 w-full rounded-md bg-white border border-slate-300 px-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
              key={`d-${leadId}-${followUpAt ?? ""}`}
            />
          </div>
        </div>
      </div>

      {showNudge && (
        <p className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 italic">
          No outreach scheduled. Enroll in a sequence or set a follow-up to keep this lead warm.
        </p>
      )}
    </section>
  );
}
