import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardList, Flame, Users, Building2, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Event Prep — the pre-event one-pager.
 * Cross-references the TIMS target list against people we actually know
 * (leads + client contacts) so whoever attends walks in with warm paths:
 * "C&W is in the room — that's the Ropes & Gray deal (LXD '27), and you
 * know Miles Mahony at RIPCO."
 */

interface TimsTarget {
  id: string;
  tenant: string;
  subject: string | null;   // "TIMS — 420,000 SF — LXD 2027"
  brokers: string | null;   // parsed from notes
  brokerage: string | null; // parsed from notes
  address: string | null;
  lxd: number | null;
  stage: string | null;
}

function parseTims(lead: any): TimsTarget {
  const notes: string = lead.notes ?? "";
  // notes format from the import: "Broker: Mark Weiss (Cushman & Wakefield) | Status as of 3/2024: ..."
  const m = notes.match(/Broker(?:age)?:\s*([^|(]+?)(?:\s*\(([^)]+)\))?\s*(?:\||$)/);
  const lxdM = (lead.subject ?? "").match(/LXD\s+(\d{4})/);
  return {
    id: lead.id,
    tenant: lead.full_name,
    subject: lead.subject,
    brokers: m?.[1]?.trim() || null,
    brokerage: m?.[2]?.trim() || (m && !m[2] ? m[1]?.trim() : null),
    address: lead.property_address,
    lxd: lxdM ? Number(lxdM[1]) : null,
    stage: lead.stage,
  };
}

const normalizeCo = (s: string) =>
  s.toLowerCase().replace(/[.,'"`&]/g, " ").replace(/\b(inc|llc|ltd|corp|company|co|group|real estate|realty)\b/g, "").replace(/\s+/g, " ").trim();

export default function BdEventPrep() {
  const { profile } = useAuth();
  const [eventId, setEventId] = useState<string>("");

  const { data: events = [] } = useQuery({
    queryKey: ["prep-events"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_events")
        .select("id, name, start_date, status, location")
        .in("status", ["APPROVED", "REGISTERED"])
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: timsLeads = [] } = useQuery({
    queryKey: ["prep-tims"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, subject, notes, property_address, stage")
        .ilike("subject", "TIMS%")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: knownLeads = [] } = useQuery({
    queryKey: ["prep-known-leads"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, company, role, contact_email, hot_opportunity, stage, event:bd_events!leads_event_id_fkey(name)")
        .eq("source_type", "EVENT")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["prep-contacts"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("id, name, title, company_name, email, client:clients!client_contacts_client_id_fkey(id, name)")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const targets = useMemo(
    () => timsLeads.map(parseTims).sort((a, b) => (a.lxd ?? 9999) - (b.lxd ?? 9999)),
    [timsLeads],
  );

  // Warm paths: for every brokerage on the target list, who do we already know there?
  const warmPaths = useMemo(() => {
    const firms = new Map<string, { firm: string; deals: string[]; people: { name: string; kind: string; detail: string; href: string }[] }>();
    for (const t of targets) {
      if (!t.brokerage) continue;
      const key = normalizeCo(t.brokerage);
      if (!key) continue;
      if (!firms.has(key)) firms.set(key, { firm: t.brokerage, deals: [], people: [] });
      firms.get(key)!.deals.push(`${t.tenant}${t.lxd ? ` (LXD ${t.lxd})` : ""}${t.brokers ? ` — ${t.brokers}` : ""}`);
    }
    for (const [key, entry] of firms) {
      for (const l of knownLeads as any[]) {
        if (l.company && normalizeCo(l.company) === key)
          entry.people.push({ name: l.full_name, kind: "Lead", detail: [l.role, (l as any).event?.name && `met @ ${(l as any).event.name}`].filter(Boolean).join(" · "), href: `/bd/leads/${l.id}` });
      }
      for (const c of contacts as any[]) {
        const co = c.company_name || c.client?.name;
        if (co && normalizeCo(co) === key)
          entry.people.push({ name: c.name, kind: "Contact", detail: [c.title, c.client?.name].filter(Boolean).join(" · "), href: c.client?.id ? `/clients/${c.client.id}` : "/clients" });
      }
    }
    return Array.from(firms.values()).sort((a, b) => b.people.length - a.people.length);
  }, [targets, knownLeads, contacts]);

  const inviteList = useMemo(
    () => (knownLeads as any[]).filter((l) => l.hot_opportunity || !["WON", "LOST"].includes(l.stage ?? "")).slice(0, 12),
    [knownLeads],
  );

  const ev = (events as any[]).find((e) => e.id === (eventId || (events as any[])[0]?.id));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in pb-10 print:max-w-full">
        <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />Event Prep
            </h1>
            <p className="text-muted-foreground mt-1">Who's in the room, which deals they're on, and who you already know.</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
        </div>

        <Select value={eventId || (events as any[])[0]?.id || ""} onValueChange={setEventId}>
          <SelectTrigger className="max-w-md print:hidden"><SelectValue placeholder="Pick the event…" /></SelectTrigger>
          <SelectContent>
            {(events as any[]).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}{e.start_date ? ` — ${new Date(e.start_date + "T12:00:00").toLocaleDateString()}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {ev && (
          <div className="hidden print:block">
            <h2 className="text-xl font-bold">{ev.name} — Prep Sheet</h2>
            <p className="text-sm">{ev.start_date} · {ev.location}</p>
          </div>
        )}

        {/* Warm paths */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Warm paths — brokerages on the TIMS list where you know someone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warmPaths.filter((w) => w.people.length > 0).length === 0 && (
              <p className="text-sm text-muted-foreground">No matches yet — capture more contacts (each one unlocks the firms they belong to).</p>
            )}
            {warmPaths.filter((w) => w.people.length > 0).map((w) => (
              <div key={w.firm} className="rounded-md border p-3">
                <p className="font-semibold text-sm flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{w.firm}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Active deals: {w.deals.slice(0, 4).join(" · ")}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {w.people.map((p, i) => (
                    <Link key={i} to={p.href} className="text-xs rounded-full border px-2 py-1 hover:bg-muted">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground"> — {p.kind}{p.detail ? ` · ${p.detail}` : ""}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* TIMS targets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">TIMS targets by lease clock (talk track: "who's handling the build-out?")</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead><TableHead>LXD</TableHead>
                    <TableHead>Broker</TableHead><TableHead>Brokerage</TableHead>
                    <TableHead className="hidden sm:table-cell">Current location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium"><Link to={`/bd/leads/${t.id}`} className="hover:underline">{t.tenant}</Link></TableCell>
                      <TableCell>{t.lxd ?? "—"}</TableCell>
                      <TableCell>{t.brokers ?? "—"}</TableCell>
                      <TableCell>{t.brokerage ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{t.address ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Invite list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" />Bring-along / say-hi list (open event leads)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {inviteList.length === 0 && <p className="text-sm text-muted-foreground">No open event leads yet.</p>}
            {inviteList.map((l: any) => (
              <Link key={l.id} to={`/bd/leads/${l.id}`} className="text-xs rounded-full border px-2 py-1 hover:bg-muted">
                {l.hot_opportunity && "🔥 "}{l.full_name}
                <span className="text-muted-foreground">{l.company ? ` — ${l.company}` : ""}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
