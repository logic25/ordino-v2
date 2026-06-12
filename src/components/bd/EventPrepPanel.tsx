import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Prep panel for a single event. Two sections per Sai's spec:
 *  1. "Who you know going" — attendee-scoped warm paths (TIMS brokerages
 *     + known contacts at companies the attendees have worked).
 *  2. "Others in this market" — broader: contacts matching the event's
 *     category / target_audience.
 */
const normalizeCo = (s: string) =>
  s.toLowerCase()
    .replace(/[.,'"`&]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|company|co|group|real estate|realty)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function EventPrepPanel({
  eventId,
  category,
  targetAudience,
}: {
  eventId: string;
  category: string | null;
  targetAudience: string | null;
}) {
  const { profile } = useAuth();

  // Attendees for this event (warm-paths section "who you know going")
  const { data: attendees = [] } = useQuery({
    queryKey: ["event-prep-attendees", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_event_attendees")
        .select("user_id")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data || []).map((r: any) => r.user_id as string);
    },
  });

  // TIMS targets (parsed broker/brokerage from notes) — SCOPED to leads owned
  // or created by event attendees only.
  const { data: timsLeads = [] } = useQuery({
    queryKey: ["event-prep-tims", eventId, attendees],
    enabled: !!profile?.company_id && attendees.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, subject, notes, property_address, stage, assigned_to, created_by")
        .ilike("subject", "TIMS%")
        .is("deleted_at", null)
        .or(
          [
            `assigned_to.in.(${attendees.join(",")})`,
            `created_by.in.(${attendees.join(",")})`,
          ].join(","),
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  // Event-source leads we've already met (for company matching) — also scoped.
  const { data: knownLeads = [] } = useQuery({
    queryKey: ["event-prep-known-leads", eventId, attendees],
    enabled: !!profile?.company_id && attendees.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, company, role, hot_opportunity, stage, assigned_to, created_by")
        .eq("source_type", "EVENT")
        .is("deleted_at", null)
        .or(
          [
            `assigned_to.in.(${attendees.join(",")})`,
            `created_by.in.(${attendees.join(",")})`,
          ].join(","),
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["event-prep-contacts"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("id, name, title, company_name, client:clients!client_contacts_client_id_fkey(id, name)")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Section 1: brokerages on TIMS list → contacts you already know
  const warmPaths = useMemo(() => {
    const firms = new Map<
      string,
      { firm: string; deals: string[]; people: { name: string; kind: string; detail: string; href: string }[] }
    >();
    for (const lead of timsLeads as any[]) {
      const notes: string = lead.notes ?? "";
      const m = notes.match(/Broker(?:age)?:\s*([^|(]+?)(?:\s*\(([^)]+)\))?\s*(?:\||$)/);
      const brokerage = m?.[2]?.trim() || (m && !m[2] ? m[1]?.trim() : null);
      if (!brokerage) continue;
      const key = normalizeCo(brokerage);
      if (!key) continue;
      const lxdM = (lead.subject ?? "").match(/LXD\s+(\d{4})/);
      if (!firms.has(key)) firms.set(key, { firm: brokerage, deals: [], people: [] });
      firms.get(key)!.deals.push(
        `${lead.full_name}${lxdM ? ` (LXD ${lxdM[1]})` : ""}`,
      );
    }
    for (const [key, entry] of firms) {
      for (const l of knownLeads as any[]) {
        if (l.company && normalizeCo(l.company) === key)
          entry.people.push({
            name: l.full_name, kind: "Lead",
            detail: l.role ?? "",
            href: `/bd/leads/${l.id}`,
          });
      }
      for (const c of contacts as any[]) {
        const co = c.company_name || c.client?.name;
        if (co && normalizeCo(co) === key)
          entry.people.push({
            name: c.name, kind: "Contact",
            detail: [c.title, c.client?.name].filter(Boolean).join(" · "),
            href: c.client?.id ? `/clients/${c.client.id}` : "/clients",
          });
      }
    }
    return Array.from(firms.values()).filter((w) => w.people.length > 0)
      .sort((a, b) => b.people.length - a.people.length);
  }, [timsLeads, knownLeads, contacts]);

  // Section 2: "Others in this market" — contacts matching category/target_audience
  const marketKey = useMemo(() => {
    const s = (targetAudience || category || "").toLowerCase();
    return s || null;
  }, [category, targetAudience]);

  const marketContacts = useMemo(() => {
    if (!marketKey) return [];
    return (contacts as any[]).filter((c) => {
      const blob = `${c.title ?? ""} ${c.company_name ?? ""} ${c.client?.name ?? ""}`.toLowerCase();
      return marketKey.split(/[,\/+&]| and /).some((tok) => {
        const t = tok.trim();
        return t.length >= 3 && blob.includes(t);
      });
    }).slice(0, 12);
  }, [contacts, marketKey]);

  // Hide "Others in this market" entirely unless BOTH category and targetAudience
  // are set — avoids dumping the global firm list on every event.
  const showMarketSection = !!(category && targetAudience);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />Prep — Conversation Card
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Section 1 — warm paths scoped to attendees */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Who you know going
          </div>
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add team members going to this event to see warm paths.
            </p>
          ) : warmPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No brokerage matches from this team's TIMS leads yet.
            </p>
          ) : (
            <div className="space-y-2">
              {warmPaths.map((w) => (
                <div key={w.firm} className="rounded-md border p-2.5">
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />{w.firm}
                  </p>
                  {w.deals.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Active deals: {w.deals.slice(0, 4).join(" · ")}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.people.map((p, i) => (
                      <Link key={i} to={p.href}
                        className="text-xs rounded-full border px-2 py-0.5 hover:bg-muted">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">
                          {" "}— {p.kind}{p.detail ? ` · ${p.detail}` : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2 — others in this market (only when both fields set) */}
        {showMarketSection && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Others in this market
              <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                {targetAudience}
              </Badge>
            </div>
            {marketContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts match "{targetAudience}" yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {marketContacts.map((c: any) => (
                  <Link key={c.id}
                    to={c.client?.id ? `/clients/${c.client.id}` : "/clients"}
                    className="text-xs rounded-full border px-2 py-0.5 hover:bg-muted">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">
                      {c.title ? ` — ${c.title}` : ""}{c.client?.name ? ` · ${c.client.name}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
