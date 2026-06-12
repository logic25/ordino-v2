import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Building2, Target, Copy, Check, Sparkles, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventAttendees } from "@/hooks/useBdEvents";
import { AttendeeAvatarStack } from "@/components/bd/AttendeesPicker";
import { useToast } from "@/hooks/use-toast";

/**
 * Event prep card — "Who's going / who to find."
 *
 * Pulls our active leads (NEW / CONTACTED / QUALIFIED or hot_opportunity=true)
 * and surfaces ones whose name or company shows up in `event.intel.key_attendees`
 * or `event.notes`. For cold events, paste the attendee list into Notes and we'll
 * match against your target list.
 */

const ACTIVE_LEAD_STAGES = ["NEW", "CONTACTED", "QUALIFIED"] as const;

const normalize = (s: string) =>
  s.toLowerCase().replace(/[.,'"`&()]/g, " ").replace(/\s+/g, " ").trim();

function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    normalize(text)
      .split(/[\n,;|/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3),
  );
}

// Accept legacy string OR new string[] for talking_points.
function asTalkingPoints(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function EventPrepPanel({
  eventId,
  category: _category,
  targetAudience: _targetAudience,
  notes,
  intel,
}: {
  eventId: string;
  category: string | null;
  targetAudience: string | null;
  notes?: string | null;
  intel?: Record<string, any> | null;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Active (pre-proposal) leads + any hot_opportunity in any stage.
  const { data: leads = [] } = useQuery({
    queryKey: ["event-prep-active-leads", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, company, role, stage, property_address, hot_opportunity")
        .or(`stage.in.(${ACTIVE_LEAD_STAGES.join(",")}),hot_opportunity.eq.true`)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendees = [] } = useEventAttendees(eventId);

  const keyAttendees: string | null = intel?.key_attendees ?? null;
  const talkingPoints = useMemo(
    () => asTalkingPoints(intel?.talking_points),
    [intel?.talking_points],
  );

  // Match leads whose name, company, or property_address appears in
  // key_attendees / notes.
  const matches = useMemo(() => {
    const blobTokens = new Set<string>([
      ...tokenize(keyAttendees),
      ...tokenize(notes),
    ]);
    const blob = normalize(`${keyAttendees ?? ""} ${notes ?? ""}`);
    if (!blob) return [];

    return (leads as any[]).filter((l) => {
      const name = normalize(l.full_name ?? "");
      const company = normalize(l.company ?? "");
      const addr = normalize(l.property_address ?? "");
      const tokenHit = (s: string) =>
        s.length >= 3 && (blobTokens.has(s) || blob.includes(s));
      return (
        (name && tokenHit(name)) ||
        (company && tokenHit(company)) ||
        (addr && tokenHit(addr))
      );
    });
  }, [leads, keyAttendees, notes]);

  const hasContext = !!(keyAttendees || notes);

  const copyPoint = (point: string, idx: number) => {
    navigator.clipboard.writeText(point).then(() => {
      setCopiedIdx(idx);
      toast({ title: "Copied" });
      setTimeout(() => setCopiedIdx((p) => (p === idx ? null : p)), 1200);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />Prep — Who's going / who to find
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Section 1 — Target list matches */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            <Target className="h-3.5 w-3.5" />Likely there → reason to talk
          </div>
          {!hasContext ? (
            <p className="text-sm text-muted-foreground">
              Paste the attendee list or speaker bios into Notes — we'll match
              against your target list.
            </p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No target-list leads matched the attendee list yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {matches.map((l: any) => (
                <Link
                  key={l.id}
                  to={`/bd/leads/${l.id}`}
                  className="text-xs rounded-full border px-2 py-0.5 hover:bg-muted inline-flex items-center gap-1.5"
                >
                  {l.hot_opportunity ? (
                    <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                  ) : (
                    <Building2 className="h-3 w-3 opacity-60" />
                  )}
                  <span className="font-medium">{l.full_name}</span>
                  {(l.company || l.role) && (
                    <span className="text-muted-foreground">
                      — {[l.role, l.company].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <Badge variant="outline" className="ml-0.5 h-4 text-[10px] px-1">
                    {l.stage}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Section 2 — Talking points (chips, copy-able) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            <Sparkles className="h-3.5 w-3.5" />Talking points
          </div>
          {talkingPoints.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Use "Draft strategy with AI" or add points under Strategy → talking_points.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {talkingPoints.map((tp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => copyPoint(tp, i)}
                  className="text-xs rounded-full border bg-muted/40 px-2.5 py-1 hover:bg-muted inline-flex items-center gap-1.5 max-w-md text-left"
                  title="Click to copy"
                >
                  <span className="truncate">{tp}</span>
                  {copiedIdx === i ? (
                    <Check className="h-3 w-3 text-green-600 shrink-0" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-50 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — Our team going (de-emphasized) */}
        {attendees.length > 0 && (
          <div className="opacity-70">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Our team going
            </div>
            <AttendeeAvatarStack
              users={(attendees as any[]).map((a) => ({
                id: a.user_id,
                first_name: a.user?.first_name ?? null,
                last_name: a.user?.last_name ?? null,
              }))}
              max={6}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
