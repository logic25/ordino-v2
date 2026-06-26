import { useMemo, useState } from "react";
import { Handshake, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBdReferrals } from "@/hooks/useBdReferrals";
import { useAuth } from "@/hooks/useAuth";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import {
  STAGE_ORDER,
  ALL_STAGES,
  STAGE_META,
  SOURCE_TYPE_META,
  isStalled,
  type ReferralStage,
} from "@/components/bd/referralConstants";
import { safeFormatDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

function ownerName(p?: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "Unassigned";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

export default function BdReferrals() {
  const { profile } = useAuth();
  const { data: profiles = [] } = useAssignableProfiles();
  const [ownerFilter, setOwnerFilter] = useState<string | "all" | "me">("all");

  const resolvedAssignee =
    ownerFilter === "all" ? null : ownerFilter === "me" ? profile?.id ?? null : ownerFilter;

  const { data: referrals = [], isLoading } = useBdReferrals({
    assignedTo: resolvedAssignee,
  });

  const grouped = useMemo(() => {
    const g: Record<ReferralStage, typeof referrals> = {
      ASK_MADE: [],
      INTRO_RECEIVED: [],
      MEETING_SET: [],
      PROPOSAL: [],
      WON: [],
      LOST: [],
    };
    for (const r of referrals) g[r.stage]?.push(r);
    return g;
  }, [referrals]);

  const ownerChips = useMemo(() => {
    // Limit to common BD owners — anyone with referrals OR known names; fall back to all profiles.
    const ids = new Set(referrals.map((r) => r.assigned_to).filter(Boolean) as string[]);
    return profiles.filter((p) => ids.has(p.id) || ["Chris", "Natalia", "Manny"].includes(p.first_name || ""));
  }, [profiles, referrals]);

  const stalledCount = referrals.filter(isStalled).length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="h-6 w-6" /> Referrals
          </h1>
          <p className="text-sm text-muted-foreground">
            Referrals you're chasing, grouped by stage. {stalledCount > 0 && (
              <span className="text-red-600 font-medium">{stalledCount} stalled.</span>
            )}
          </p>
        </div>
      </div>

      {/* Owner filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          size="sm"
          variant={ownerFilter === "all" ? "default" : "outline"}
          onClick={() => setOwnerFilter("all")}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={ownerFilter === "me" ? "default" : "outline"}
          onClick={() => setOwnerFilter("me")}
        >
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
          No referrals yet. Phase 2 will add the capture modal — for now, seed rows via the database.
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
                {rows.map((r) => {
                  const stalled = isStalled(r);
                  const SrcIcon = SOURCE_TYPE_META[r.source_type].icon;
                  const sourceName =
                    r.source_contact?.name || r.source_label || "—";
                  return (
                    <Card key={r.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.referred_name}</span>
                          {r.referred_company && (
                            <span className="text-muted-foreground">· {r.referred_company}</span>
                          )}
                          {stalled && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px]">
                              Stalled
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <SrcIcon className="h-3 w-3" />
                            {SOURCE_TYPE_META[r.source_type].label}: {sourceName}
                          </span>
                          <span>Owner: {ownerName(r.assignee)}</span>
                          <span>
                            Next:{" "}
                            {r.next_action_at
                              ? safeFormatDate(r.next_action_at, "MMM d, yyyy")
                              : <span className="text-red-600">none set</span>}
                          </span>
                          {r.next_action_note && (
                            <span className="italic">"{r.next_action_note}"</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
