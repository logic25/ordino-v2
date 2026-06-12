import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Event prep card — "Who's going / who to find."
 *
 * Pulls our active leads (NEW / CONTACTED / QUALIFIED — i.e. pre-Proposal,
 * still-being-worked) and surfaces ones whose name or company shows up in
 * `event.intel.key_attendees` or `event.notes`. The whole point is: walk in
 * with a short list of names to look for.
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

  // Active (pre-proposal) leads — the people we'd actually want to bump into.
  const { data: leads = [] } = useQuery({
    queryKey: ["event-prep-active-leads", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, company, role, stage, property_address")
        .in("stage", ACTIVE_LEAD_STAGES as unknown as any)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const keyAttendees: string | null = intel?.key_attendees ?? null;
  const talkingPoints: string | null = intel?.talking_points ?? null;

  // Match leads whose name or company appears in key_attendees / notes.
  const matches = useMemo(() => {
    const blobTokens = new Set<string>([
      ...tokenize(keyAttendees),
      ...tokenize(notes),
    ]);
    // Also keep the raw blob for substring fallback on multi-word names/companies.
    const blob = normalize(`${keyAttendees ?? ""} ${notes ?? ""}`);
    if (!blob) return [];

    return (leads as any[]).filter((l) => {
      const name = normalize(l.full_name ?? "");
      const company = normalize(l.company ?? "");
      const tokenHit = (s: string) =>
        s.length >= 3 && (blobTokens.has(s) || blob.includes(s));
      return (name && tokenHit(name)) || (company && tokenHit(company));
    });
  }, [leads, keyAttendees, notes]);

  const hasContext = !!(keyAttendees || notes);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />Prep — Who's going / who to find
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            <Target className="h-3.5 w-3.5" />Look for these leads at the event
          </div>
          {!hasContext ? (
            <p className="text-sm text-muted-foreground">
              Add an attendee list to <em>Key attendees</em> (under Strategy → Show research)
              or paste it into Notes. We'll match it against your active leads.
            </p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active leads (New / Contacted / Qualified) match this event's
              attendee list yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {matches.map((l: any) => (
                <Link
                  key={l.id}
                  to={`/bd/leads/${l.id}`}
                  className="text-xs rounded-full border px-2 py-0.5 hover:bg-muted inline-flex items-center gap-1.5"
                >
                  <Building2 className="h-3 w-3 opacity-60" />
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

        {talkingPoints && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Talking points
            </div>
            <p className="text-sm whitespace-pre-wrap">{talkingPoints}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
