import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2, Mail, Phone, MessageSquare, Users } from "lucide-react";
import {
  SOURCE_TYPE_META,
  STAGE_META,
  daysSinceUpdate,
  isFridayStalled,
} from "@/components/bd/referralConstants";
import {
  useBdReferrals,
  useNudgeBdReferral,
  type BdReferral,
} from "@/hooks/useBdReferrals";
import { useToast } from "@/hooks/use-toast";

type Channel = "email" | "call" | "text" | "in_person";

function ownerName(p?: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "Unassigned";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

function defaultNudgeBody(r: BdReferral) {
  const src = r.source_contact?.name || r.source_label || "there";
  const first = src.split(" ")[0];
  return (
    `Hi ${first},\n\n` +
    `Just circling back on the intro to ${r.referred_name}` +
    (r.referred_company ? ` at ${r.referred_company}` : "") +
    `. Any update on your end? Happy to make it easy — a quick note or a warm intro email is all we need.\n\n` +
    `Thanks again for thinking of us.`
  );
}

export function ReferralFridayView({
  ownerId,
}: {
  ownerId: string | null;
}) {
  const { toast } = useToast();
  const nudge = useNudgeBdReferral();

  const { data: referrals = [], isLoading } = useBdReferrals({ assignedTo: ownerId });
  const stalled = useMemo(
    () =>
      referrals
        .filter(isFridayStalled)
        .sort((a, b) => daysSinceUpdate(b) - daysSinceUpdate(a)),
    [referrals],
  );

  const [target, setTarget] = useState<BdReferral | null>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [note, setNote] = useState("");

  const openNudge = (r: BdReferral) => {
    setTarget(r);
    setChannel(r.source_contact?.email ? "email" : "call");
    setNote("");
  };

  const submitNudge = async () => {
    if (!target) return;
    try {
      await nudge.mutateAsync({
        referralId: target.id,
        channel,
        note: note.trim() || undefined,
      });
      toast({
        title: "Nudge logged",
        description: `Next action bumped 7 days. ${
          channel === "email" ? "Opening your mail client…" : ""
        }`.trim(),
      });
      if (channel === "email") {
        const email = target.source_contact?.email;
        if (email) {
          const subject = encodeURIComponent(`Quick nudge — ${target.referred_name}`);
          const body = encodeURIComponent(defaultNudgeBody(target));
          window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
        }
      }
      setTarget(null);
    } catch (e: any) {
      toast({ title: "Could not log nudge", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stalled.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground space-y-1">
        <div className="font-medium text-foreground">Inbox zero — nothing stalled.</div>
        <div>
          Referrals show up here once they've gone 7+ days without an update.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-amber-50 border-amber-200 text-xs text-amber-900 flex items-start gap-2">
        <CalendarClock className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Friday View — {stalled.length} to work</div>
          <div>
            These referrals haven't moved in over a week. Send a nudge to the source, or
            snooze the next action forward.
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {stalled.map((r) => {
          const SrcIcon = SOURCE_TYPE_META[r.source_type].icon;
          const days = daysSinceUpdate(r);
          const meta = STAGE_META[r.stage];
          const sourceName = r.source_contact?.name || r.source_label || "—";
          const sourceEmail = r.source_contact?.email;
          return (
            <Card key={r.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.referred_name}</span>
                    {r.referred_company && (
                      <span className="text-muted-foreground text-sm">
                        · {r.referred_company}
                      </span>
                    )}
                    <Badge className={`${meta.className} text-[10px] hover:${meta.className}`}>
                      {meta.label}
                    </Badge>
                    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px]">
                      {days}d stalled
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <SrcIcon className="h-3 w-3" />
                      {SOURCE_TYPE_META[r.source_type].label}: {sourceName}
                      {sourceEmail && <span className="text-muted-foreground/70">({sourceEmail})</span>}
                    </span>
                    <span>Owner: {ownerName(r.assignee)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => openNudge(r)}
                    disabled={nudge.isPending}
                  >
                    Nudge source
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() =>
                      nudge
                        .mutateAsync({ referralId: r.id, channel: "in_person", note: "Snoozed 7 days." })
                        .then(() => toast({ title: "Snoozed 7 days" }))
                        .catch((e) =>
                          toast({ title: "Could not snooze", description: e.message, variant: "destructive" }),
                        )
                    }
                    disabled={nudge.isPending}
                  >
                    Snooze 7d
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nudge source</DialogTitle>
            <DialogDescription>
              Logs the outreach on the referral and pushes the next action out by 7 days.
            </DialogDescription>
          </DialogHeader>

          {target && (
            <div className="space-y-3">
              <div className="rounded-md border p-2 text-xs bg-muted/40">
                <div>
                  <span className="text-muted-foreground">Referral:</span>{" "}
                  <span className="font-medium">{target.referred_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>{" "}
                  {target.source_contact?.name || target.source_label || "—"}
                  {target.source_contact?.email && (
                    <span className="text-muted-foreground/80">
                      {" "}
                      · {target.source_contact.email}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" /> Email
                        {!target.source_contact?.email && (
                          <span className="text-[10px] text-muted-foreground">
                            (no address on file)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                    <SelectItem value="call">
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" /> Call
                      </span>
                    </SelectItem>
                    <SelectItem value="text">
                      <span className="inline-flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5" /> Text
                      </span>
                    </SelectItem>
                    <SelectItem value="in_person">
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" /> In person
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Note (optional)</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you say / what are you waiting on?"
                />
              </div>

              {channel === "email" && target.source_contact?.email && (
                <p className="text-[11px] text-muted-foreground">
                  We'll open your mail client with a pre-filled draft to{" "}
                  <span className="font-medium">{target.source_contact.email}</span>.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitNudge} disabled={nudge.isPending}>
              {nudge.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Log nudge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
