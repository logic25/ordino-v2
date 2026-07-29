import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, HeartPulse, Loader2 } from "lucide-react";
import { useClientHealth, useClientHealthDataQuality, useClientHealthFilterOptions } from "@/hooks/useClientHealth";
import { useIsAdmin } from "@/hooks/useUserRoles";
import ClientHealthTable from "./ClientHealthTable";
import ConcentrationPilotPreview from "./ConcentrationPilotPreview";
import { downloadCSV, toCSV } from "@/lib/exports/proposalsExport";

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function ClientHealthTab() {
  const isAdmin = useIsAdmin();
  const { data: rows, isLoading } = useClientHealth();
  const { data: dq } = useClientHealthDataQuality();
  const { data: options } = useClientHealthFilterOptions();

  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [dormantOnly, setDormantOnly] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  const filtered = useMemo(() => {
    return (rows || []).filter((r) => {
      if (owner !== "all" && !(r.owner_ids || []).includes(owner)) return false;
      if (source !== "all" && !(r.lead_sources || []).includes(source)) return false;
      if (search && !(r.client_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (dormantOnly && !r.is_dormant) return false;
      if (incompleteOnly && !r.has_incomplete_data) return false;
      return true;
    });
  }, [rows, owner, source, search, dormantOnly, incompleteOnly]);

  const totals = useMemo(() => {
    const proposed = filtered.reduce((s, r) => s + Number(r.ytd_proposed_value || 0), 0);
    const billed = filtered.reduce((s, r) => s + Number(r.lifetime_billed_value || 0), 0);
    const sent = filtered.reduce((s, r) => s + r.ytd_sent_count, 0);
    const converted = filtered.reduce((s, r) => s + r.ytd_converted_count, 0);
    return {
      proposed,
      billed,
      dormant: filtered.filter((r) => r.is_dormant).length,
      active: filtered.filter((r) => (r.days_since_last_activity ?? 99999) <= 90).length,
      conversion: sent ? Math.round((converted / sent) * 1000) / 10 : null,
    };
  }, [filtered]);

  const exportTable = () => {
    const headers = [
      "Client",
      "Proposed YTD (proposed, not billed)",
      "Conversion YTD %",
      "Active projects",
      "Days since activity",
      "First proposal",
      "Lifetime billed",
      "Reliability score",
      "Dormant",
      "Data incomplete",
      "Inferred owner",
    ];
    const csvRows = filtered.map((r) => [
      r.client_name,
      r.ytd_proposed_value,
      r.ytd_conversion_rate ?? "",
      r.active_project_count,
      r.days_since_last_activity ?? "",
      r.first_proposal_date || "",
      r.lifetime_billed_value ?? "",
      r.payment_reliability_score ?? "",
      r.is_dormant ? "yes" : "no",
      r.has_incomplete_data ? "yes" : "no",
      r.any_owner_inferred ? "yes" : "no",
    ]);
    downloadCSV(`client-health-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, csvRows));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Data quality strip */}
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-xs">
          <div>
            <span className="text-muted-foreground">Salesperson fill rate: </span>
            <span className="font-semibold">
              {dq?.fillRatePct === null || dq?.fillRatePct === undefined ? "—" : `${dq.fillRatePct}%`}
            </span>
            <span className="text-muted-foreground">
              {dq ? ` (${dq.withSalesPerson}/${dq.totalProposals} proposals)` : ""}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Proposals missing a sent date: </span>
            <span className="font-semibold">{dq?.missingSentAt ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Clients with incomplete data: </span>
            <span className="font-semibold">{(rows || []).filter((r) => r.has_incomplete_data).length}</span>
          </div>
          <div className="text-muted-foreground">
            Ownership falls back to whoever created the proposal when no salesperson is set — those rows are tagged
            “inferred”.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Proposed YTD" value={fmtMoney(totals.proposed)} hint="proposed, not billed" />
        <StatTile
          label="Conversion YTD"
          value={totals.conversion === null ? "No data yet" : `${totals.conversion}%`}
          hint="proposals sent this year"
        />
        <StatTile label="Active in last 90 days" value={String(totals.active)} hint="clients with recent activity" />
        <StatTile label="Dormant clients" value={String(totals.dormant)} hint="past the dormancy threshold" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-primary" />
              Client Health
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportTable}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Input
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[200px]"
            />
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {(options?.owners || []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Lead source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {(options?.leadSources || []).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={dormantOnly ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setDormantOnly(!dormantOnly)}
            >
              Dormant only
            </Button>
            <Button
              variant={incompleteOnly ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setIncompleteOnly(!incompleteOnly)}
            >
              Incomplete data only
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ClientHealthTable rows={filtered} />
        </CardContent>
      </Card>

      {isAdmin && <ConcentrationPilotPreview rows={rows || []} />}
    </div>
  );
}
