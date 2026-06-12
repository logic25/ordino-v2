import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Globe2, Plus, MoreHorizontal, Trash2, Pencil, Check, X, Minus,
  Loader2, ExternalLink, Database, BookOpenCheck, Gauge,
} from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { profileLabel } from "@/components/bd/leadConstants";
import {
  useJurisdictions, useCreateJurisdiction, useUpdateJurisdiction, useDeleteJurisdiction,
  type Jurisdiction, type JurisdictionStatus,
} from "@/hooks/useJurisdictions";

const STATUS_META: Record<JurisdictionStatus, { label: string; className: string }> = {
  researching: { label: "Researching", className: "bg-gray-100 text-gray-700 border-gray-200" },
  candidate: { label: "Candidate", className: "bg-blue-100 text-blue-700 border-blue-200" },
  validating: { label: "Validating", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  live: { label: "Live", className: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
};
const STATUS_ORDER: JurisdictionStatus[] = ["live", "validating", "candidate", "researching", "rejected"];

function TriState({ value }: { value: boolean | null }) {
  if (value === true) return <Check className="h-3.5 w-3.5 text-green-600" />;
  if (value === false) return <X className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />;
}

function fmtMoney(n: number | null) {
  return n != null ? `$${Math.round(n).toLocaleString()}` : "—";
}

type Draft = Partial<Jurisdiction> & { name: string };
const EMPTY_DRAFT: Draft = { name: "", status: "researching" as JurisdictionStatus, research: {} };

export default function BdMarkets() {
  const { data: markets = [], isLoading } = useJurisdictions();
  const { data: profiles = [] } = useAssignableProfiles();
  const createMarket = useCreateJurisdiction();
  const updateMarket = useUpdateJurisdiction();
  const deleteMarket = useDeleteJurisdiction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState<Jurisdiction | null>(null);

  const sorted = useMemo(
    () => [...markets].sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        (a.tier ?? 9) - (b.tier ?? 9) ||
        a.name.localeCompare(b.name),
    ),
    [markets],
  );

  const totals = useMemo(() => {
    const live = markets.filter((m) => m.status === "live");
    return {
      live: live.length,
      pipeline: markets.filter((m) => ["researching", "candidate", "validating"].includes(m.status)).length,
      goal: live.reduce((s, m) => s + (m.revenue_goal ?? 0), 0),
      actual: live.reduce((s, m) => s + (m.revenue_actual ?? 0), 0),
    };
  }, [markets]);

  const openCreate = () => { setEditingId(null); setDraft(EMPTY_DRAFT); setDialogOpen(true); };
  const openEdit = (m: Jurisdiction) => { setEditingId(m.id); setDraft({ ...m }); setDialogOpen(true); };

  const set = (k: keyof Draft, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    if (editingId) {
      await updateMarket.mutateAsync({ ...draft, id: editingId } as any);
    } else {
      await createMarket.mutateAsync(draft as any);
    }
    setDialogOpen(false);
  };

  const triOptions = [
    { v: "unknown", label: "Unknown" },
    { v: "yes", label: "Yes" },
    { v: "no", label: "No" },
  ];
  const triVal = (b: boolean | null | undefined) => (b === true ? "yes" : b === false ? "no" : "unknown");
  const triParse = (s: string) => (s === "yes" ? true : s === "no" ? false : null);

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
            <p className="text-muted-foreground mt-1">
              Jurisdiction expansion pipeline — research, validate with the eval gate, go live.
            </p>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Market</Button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Live markets</p>
            <p className="text-2xl font-bold">{totals.live}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In pipeline</p>
            <p className="text-2xl font-bold">{totals.pipeline}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue goal (live)</p>
            <p className="text-2xl font-bold">{fmtMoney(totals.goal)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue actual (live)</p>
            <p className="text-2xl font-bold">{fmtMoney(totals.actual)}</p>
          </CardContent></Card>
        </div>

        {/* Market cards */}
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Globe2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No markets yet. Add your first expansion candidate.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((m) => {
              const meta = STATUS_META[m.status];
              const pct =
                m.revenue_goal && m.revenue_goal > 0
                  ? Math.min(100, Math.round(((m.revenue_actual ?? 0) / m.revenue_goal) * 100))
                  : null;
              return (
                <Card key={m.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {m.name}{m.state ? `, ${m.state}` : ""}
                          {m.tier && <Badge variant="outline" className="ml-2 text-[10px]">Tier {m.tier}</Badge>}
                        </p>
                        <Badge variant="outline" className={`mt-1 ${meta.className}`}>{meta.label}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(m)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(m)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Entry criteria */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1.5"><TriState value={m.online_filing} />Online filing</span>
                      <span className="flex items-center gap-1.5">
                        <TriState value={m.license_required === null ? null : !m.license_required} />No license req.
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TriState value={m.open_data_platform && m.open_data_platform !== "none" ? true : m.open_data_platform === "none" ? false : null} />
                        Open data{m.open_data_platform && m.open_data_platform !== "none" ? ` (${m.open_data_platform})` : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        {m.annual_permits != null ? `${m.annual_permits.toLocaleString()} permits/yr` : "Volume unknown"}
                      </span>
                    </div>

                    {/* Readiness gates */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <BookOpenCheck className="h-3 w-3" />
                        KB: {m.kb_status}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`gap-1 text-[10px] ${
                          m.eval_pass_rate != null
                            ? m.eval_pass_rate >= 90 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"
                            : ""
                        }`}
                      >
                        <Gauge className="h-3 w-3" />
                        Eval: {m.eval_pass_rate != null ? `${Math.round(m.eval_pass_rate)}%` : "not run"}
                      </Badge>
                      {m.portal_url && (
                        <a href={m.portal_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline">
                          Portal <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    {/* GTM */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {m.salesperson ? profileLabel(m.salesperson) : "No salesperson"}
                        </span>
                        <span className="font-medium">
                          {fmtMoney(m.revenue_actual)} / {fmtMoney(m.revenue_goal)}
                        </span>
                      </div>
                      {pct != null && <Progress value={pct} className="h-1.5" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit market" : "Add market"}</DialogTitle>
            <DialogDescription>
              The expansion checklist: confirm online filing, licensing, volume, and data sources.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>City *</Label>
                <Input placeholder="Tampa" value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input placeholder="FL" value={draft.state ?? ""} onChange={(e) => set("state", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={draft.status ?? "researching"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tier</Label>
                <Select value={draft.tier ? String(draft.tier) : "none"} onValueChange={(v) => set("tier", v === "none" ? null : Number(v))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="1">Tier 1 (high volume)</SelectItem>
                    <SelectItem value="2">Tier 2</SelectItem>
                    <SelectItem value="3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Entry criteria</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["online_filing", "Online filing"],
                ["plans_upload_online", "Plans upload online"],
                ["online_payments", "Online payments"],
                ["inspection_scheduling_online", "Inspections online"],
                ["license_required", "License required"],
                ["owner_auth_sufficient", "Owner auth sufficient"],
              ] as [keyof Draft, string][]).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Select value={triVal(draft[k] as boolean | null)} onValueChange={(v) => set(k, triParse(v))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {triOptions.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Permit portal URL</Label>
                <Input placeholder="https://…" value={draft.portal_url ?? ""} onChange={(e) => set("portal_url", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Annual permits</Label>
                <Input type="number" placeholder="5000" value={draft.annual_permits ?? ""}
                  onChange={(e) => set("annual_permits", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Open-data platform</Label>
                <Select value={draft.open_data_platform ?? "unknown"} onValueChange={(v) => set("open_data_platform", v === "unknown" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Unknown" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="socrata">Socrata (NYC-style)</SelectItem>
                    <SelectItem value="arcgis">ArcGIS</SelectItem>
                    <SelectItem value="accela">Accela</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Open-data URL</Label>
                <Input placeholder="https://data.…" value={draft.open_data_url ?? ""} onChange={(e) => set("open_data_url", e.target.value || null)} />
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Go-to-market</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Salesperson</Label>
                <Select value={draft.salesperson_id ?? "none"} onValueChange={(v) => set("salesperson_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>KB status</Label>
                <Select value={draft.kb_status ?? "none"} onValueChange={(v) => set("kb_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="building">Building</SelectItem>
                    <SelectItem value="loaded">Loaded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Revenue goal ($/yr)</Label>
                <Input type="number" placeholder="100000" value={draft.revenue_goal ?? ""}
                  onChange={(e) => set("revenue_goal", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Revenue actual ($/yr)</Label>
                <Input type="number" placeholder="0" value={draft.revenue_actual ?? ""}
                  onChange={(e) => set("revenue_actual", e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} placeholder="Dept contacts, competitor scan, quirks…"
                value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}
              disabled={!draft.name?.trim() || createMarket.isPending || updateMarket.isPending}>
              {(createMarket.isPending || updateMarket.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save" : "Add market"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>This removes the market and its research log. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive"
              onClick={async () => { if (confirmDelete) await deleteMarket.mutateAsync(confirmDelete.id); setConfirmDelete(null); }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
