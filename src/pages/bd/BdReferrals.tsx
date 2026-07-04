import { useMemo, useState } from "react";
import { Handshake, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBdReferrals } from "@/hooks/useBdReferrals";
import { useAuth } from "@/hooks/useAuth";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import {
  ALL_STAGES,
  STAGE_META,
  isStalled,
  type ReferralStage,
} from "@/components/bd/referralConstants";
import { cn } from "@/lib/utils";
import { ReferralCard } from "@/components/bd/ReferralCard";
import { ReferralCaptureDialog } from "@/components/bd/ReferralCaptureDialog";

function ownerName(p?: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "Unassigned";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

export default function BdReferrals() {
  const { profile } = useAuth();
  const { data: profiles = [] } = useAssignableProfiles();
  const [ownerFilter, setOwnerFilter] = useState<string | "all" | "me">("all");
  const [captureOpen, setCaptureOpen] = useState(false);

  const resolvedAssignee =
    ownerFilter === "all" ? null : ownerFilter === "me" ? profile?.id ?? null : ownerFilter;

  const { data: referrals = [], isLoading } = useBdReferrals({
    assignedTo: resolvedAssignee,
  });

  // Always pull the unfiltered list so the global chip set/stalled count are stable.
  const { data: allReferrals = [] } = useBdReferrals({});

  const grouped = useMemo(() => {
    const g: Record<ReferralStage, typeof referrals> = {
      ASK_MADE: [], INTRO_RECEIVED: [], MEETING_SET: [], PROPOSAL: [], WON: [], LOST: [],
    };
    for (const r of referrals) g[r.stage]?.push(r);
    return g;
  }, [referrals]);

  // Owner chips: anyone who owns a referral OR known BD names — but exclude the
  // current user since "Me" already represents them.
  const ownerChips = useMemo(() => {
    const ids = new Set(allReferrals.map((r) => r.assigned_to).filter(Boolean) as string[]);
    return profiles
      .filter((p) => p.id !== profile?.id)
      .filter(
        (p) => ids.has(p.id) || ["Chris", "Natalia", "Manny"].includes(p.first_name || ""),
      );
  }, [profiles, allReferrals, profile?.id]);

  const stalledCount = allReferrals.filter(isStalled).length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="h-6 w-6" /> Referrals
          </h1>
          <p className="text-sm text-muted-foreground">
            Referrals you're chasing, grouped by stage.{" "}
            {stalledCount > 0 && (
              <span className="text-red-600 font-medium">{stalledCount} stalled.</span>
            )}
          </p>
        </div>
        <Button onClick={() => setCaptureOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> New referral
        </Button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant={ownerFilter === "all" ? "default" : "outline"} onClick={() => setOwnerFilter("all")}>
          All
        </Button>
        <Button size="sm" variant={ownerFilter === "me" ? "default" : "outline"} onClick={() => setOwnerFilter("me")}>
          Me
        </Button>
        {ownerChips.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={ownerFilter === p.id ? "default" : "outline"}
            onClick={() => setOwnerFilter(p.id)}
          >
            {ownerName(p)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : referrals.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No referrals yet. Click <span className="font-medium">New referral</span> to add one.
        </Card>
      ) : (
        ALL_STAGES.map((stage) => {
          const rows = grouped[stage];
          if (!rows || rows.length === 0) return null;
          const meta = STAGE_META[stage];
          return (
            <div key={stage} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
                <span className="text-xs text-muted-foreground">{rows.length}</span>
              </div>
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <ReferralCard key={r.id} referral={r} profiles={profiles} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <ReferralCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
    </div>
  );
}
