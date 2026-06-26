import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { ReferralStageStepper } from "@/components/bd/ReferralStageStepper";
import {
  SOURCE_TYPE_META,
  STAGE_META,
  TERMINAL_STAGES,
  isStalled,
  type ReferralStage,
} from "@/components/bd/referralConstants";
import {
  useBdReferralActivities,
  useCreateBdReferralNote,
  useUpdateBdReferral,
  type BdReferral,
} from "@/hooks/useBdReferrals";
import { safeFormatDate } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Profile = { id: string; first_name: string | null; last_name: string | null };

function ownerName(p?: Profile | null) {
  if (!p) return "Unassigned";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

export function ReferralCard({
  referral,
  profiles,
}: {
  referral: BdReferral;
  profiles: Profile[];
}) {
  const { profile: me } = useAuth();
  const { toast } = useToast();
  const update = useUpdateBdReferral();
  const addNote = useCreateBdReferralNote();

  const [expanded, setExpanded] = useState(false);
  const [terminalTarget, setTerminalTarget] = useState<ReferralStage | null>(null);
  const [wonValue, setWonValue] = useState<string>("");
  const [lostReason, setLostReason] = useState<string>("");

  const [nextDate, setNextDate] = useState<string>(
    referral.next_action_at ? referral.next_action_at.slice(0, 10) : "",
  );
  const [noteDraft, setNoteDraft] = useState("");

  const { data: activities = [] } = useBdReferralActivities(expanded ? referral.id : null);

  const stalled = isStalled(referral);
  const SrcIcon = SOURCE_TYPE_META[referral.source_type].icon;
  const sourceName = referral.source_contact?.name || referral.source_label || "—";

  const handleStageChange = async (stage: ReferralStage) => {
    if (TERMINAL_STAGES.includes(stage)) {
      setTerminalTarget(stage);
      setWonValue(referral.won_value ? String(referral.won_value) : "");
      setLostReason(referral.lost_reason ?? "");
      return;
    }
    try {
      await update.mutateAsync({
        id: referral.id,
        patch: { stage },
        activity: {
          type: "STAGE_CHANGE",
          content: `Stage: ${STAGE_META[referral.stage].label} → ${STAGE_META[stage].label}`,
        },
      });
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  const confirmTerminal = async () => {
    if (!terminalTarget) return;
    const patch: any = { stage: terminalTarget };
    let detail = "";
    if (terminalTarget === "WON") {
      const v = parseFloat(wonValue);
      if (!isNaN(v) && v > 0) {
        patch.won_value = v;
        detail = ` ($${v.toLocaleString()})`;
      } else {
        patch.won_value = null;
      }
    } else if (terminalTarget === "LOST") {
      patch.lost_reason = lostReason.trim() || null;
      if (lostReason.trim()) detail = ` — ${lostReason.trim()}`;
    }
    try {
      await update.mutateAsync({
        id: referral.id,
        patch,
        activity: {
          type: "STAGE_CHANGE",
          content: `Stage: ${STAGE_META[referral.stage].label} → ${STAGE_META[terminalTarget].label}${detail}`,
        },
      });
      setTerminalTarget(null);
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  const saveNextAction = async () => {
    try {
      const newVal = nextDate || null;
      const oldVal = referral.next_action_at ? referral.next_action_at.slice(0, 10) : null;
      if (newVal === oldVal) return;
      await update.mutateAsync({
        id: referral.id,
        patch: { next_action_at: newVal },
        activity: {
          type: "SYSTEM",
          content: newVal
            ? `Next action set to ${safeFormatDate(newVal, "MMM d, yyyy")}.`
            : "Next action cleared.",
        },
      });
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    }
  };

  const reassign = async (newId: string) => {
    if (newId === (referral.assigned_to ?? "")) return;
    const newOwner = profiles.find((p) => p.id === newId);
    try {
      await update.mutateAsync({
        id: referral.id,
        patch: { assigned_to: newId },
        activity: {
          type: "STATUS_CHANGE",
          content: `Reassigned: ${ownerName(referral.assignee)} → ${ownerName(newOwner)}`,
        },
      });
    } catch (e: any) {
      toast({ title: "Could not reassign", description: e.message, variant: "destructive" });
    }
  };

  const postNote = async () => {
    const text = noteDraft.trim();
    if (!text) return;
    try {
      await addNote.mutateAsync({ referralId: referral.id, content: text });
      setNoteDraft("");
    } catch (e: any) {
      toast({ title: "Could not post note", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{referral.referred_name}</span>
            {referral.referred_company && (
              <span className="text-muted-foreground">· {referral.referred_company}</span>
            )}
            {stalled && (
              <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px]">
                Stalled
              </Badge>
            )}
            {referral.stage === "WON" && referral.won_value && (
              <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[10px]">
                ${Number(referral.won_value).toLocaleString()}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <SrcIcon className="h-3 w-3" />
              {SOURCE_TYPE_META[referral.source_type].label}: {sourceName}
            </span>
            <span>Owner: {ownerName(referral.assignee)}</span>
            <span>
              Next:{" "}
              {referral.next_action_at ? (
                safeFormatDate(referral.next_action_at, "MMM d, yyyy")
              ) : (
                <span className="text-red-600">none set</span>
              )}
            </span>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-1.5"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <ReferralStageStepper current={referral.stage} onChange={handleStageChange} />

          {!TERMINAL_STAGES.includes(referral.stage) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-600 hover:text-red-700"
                onClick={() => handleStageChange("LOST")}
              >
                <X className="h-3 w-3 mr-1" /> Mark lost
              </Button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Next action</Label>
              <div className="flex gap-1.5">
                <Input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button size="sm" className="h-8" onClick={saveNextAction} disabled={update.isPending}>
                  Set
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner</Label>
              <Select value={referral.assigned_to ?? ""} onValueChange={reassign}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Pick owner" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {ownerName(p)}
                      {p.id === me?.id && " (me)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Add note</Label>
            <Textarea
              rows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What happened?"
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button size="sm" className="h-7 text-xs" onClick={postNote} disabled={addNote.isPending || !noteDraft.trim()}>
                {addNote.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Post note
              </Button>
            </div>
          </div>

          {activities.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Activity</Label>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {activities.map((a) => (
                  <li key={a.id} className="text-xs">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          a.type === "NOTE" ? "text-slate-900" : "text-muted-foreground",
                        )}
                      >
                        {a.type === "NOTE" ? ownerName(a.author) : a.type.replace("_", " ")}
                      </span>
                      <span className="text-muted-foreground">
                        {safeFormatDate(a.created_at, "MMM d, h:mm a")}
                      </span>
                    </div>
                    {a.content && <div className="text-slate-700">{a.content}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!terminalTarget} onOpenChange={(v) => !v && setTerminalTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Mark as {terminalTarget && STAGE_META[terminalTarget].label}?
            </DialogTitle>
            <DialogDescription>
              {terminalTarget === "WON"
                ? "Capture the won value (optional). You can convert this to a lead later."
                : "Capture why this was lost (optional)."}
            </DialogDescription>
          </DialogHeader>
          {terminalTarget === "WON" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Won value ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={wonValue}
                onChange={(e) => setWonValue(e.target.value)}
                placeholder="e.g. 12500"
                className="h-9"
              />
            </div>
          )}
          {terminalTarget === "LOST" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Lost reason</Label>
              <Textarea
                rows={3}
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="e.g. Went with in-house, no budget, ghosted."
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminalTarget(null)}>Cancel</Button>
            <Button onClick={confirmTerminal} disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
