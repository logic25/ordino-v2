import { useMemo, useState } from "react";
import {
  useMarketCompetitors,
  useAddMarketCompetitor,
  useUpdateMarketCompetitor,
  useVerifyMarketCompetitor,
  useDeleteMarketCompetitor,
  useImportMarketCompetitors,
  type Market,
  type MarketCompetitor,
  type CompetitorScope,
  type CompetitorPricingModel,
  type ParsedCompetitor,
} from "@/hooks/useMarkets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, ShieldCheck, ExternalLink, Upload, Loader2, Link as LinkIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SCOPES: CompetitorScope[] = ["solo", "local", "regional", "national"];
const MODELS: CompetitorPricingModel[] = ["flat", "hourly", "percent", "mixed", "unknown"];

function ScopeBadge({ scope }: { scope: CompetitorScope }) {
  const cls =
    scope === "national" ? "bg-purple-100 text-purple-700 border-purple-200"
      : scope === "regional" ? "bg-blue-100 text-blue-700 border-blue-200"
      : scope === "local" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  return <Badge variant="outline" className={cls}>{scope}</Badge>;
}

function ModelBadge({ model }: { model: CompetitorPricingModel }) {
  if (model === "unknown") return <Badge variant="outline" className="bg-muted text-muted-foreground">unknown</Badge>;
  return <Badge variant="outline">{model}</Badge>;
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
      <ShieldCheck className="h-3 w-3" /> Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Unverified</Badge>
  );
}

type EditState = Partial<MarketCompetitor> & { name: string };

function CompetitorDialog({
  open, onOpenChange, initial, onSave, busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: EditState;
  onSave: (v: EditState) => void;
  busy?: boolean;
}) {
  const [form, setForm] = useState<EditState>(initial);
  // reset when opening
  useMemo(() => { if (open) setForm(initial); }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit competitor" : "Add competitor"}</DialogTitle>
          <DialogDescription>Editing any authoritative field will clear verification.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Name *</label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Website</label>
            <Input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Scope</label>
              <Select value={form.scope ?? "local"} onValueChange={(v) => setForm({ ...form, scope: v as CompetitorScope })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Pricing model</label>
              <Select value={form.pricing_model ?? "unknown"} onValueChange={(v) => setForm({ ...form, pricing_model: v as CompetitorPricingModel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Pricing (observed)</label>
            <Textarea rows={2} value={form.pricing_text ?? ""} onChange={(e) => setForm({ ...form, pricing_text: e.target.value })} placeholder='e.g. "$500–$3,000 per commercial permit (forum estimate)"' />
          </div>
          <div>
            <label className="text-xs font-medium">Source URL</label>
            <Input value={form.source_url ?? ""} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-medium">Signal / reputation notes</label>
            <Textarea rows={2} value={form.signal_notes ?? ""} onChange={(e) => setForm({ ...form, signal_notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={busy || !(form.name ?? "").trim()}
          >
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseCsv(text: string): ParsedCompetitor[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return {
      name: row.name,
      url: row.url || undefined,
      scope: (row.scope || undefined) as CompetitorScope | undefined,
      pricing_text: row.pricing_text || undefined,
      pricing_model: (row.pricing_model || undefined) as CompetitorPricingModel | undefined,
      source_url: row.source_url || undefined,
      signal_notes: row.signal_notes || undefined,
    };
  });
}

function parseJson(text: string): ParsedCompetitor[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.competitors) ? parsed.competitors : [];
  return arr.map((r: any) => ({
    name: String(r.name ?? "").trim(),
    url: r.url,
    scope: r.scope,
    pricing_text: r.pricing_text,
    pricing_model: r.pricing_model,
    source_url: r.source_url,
    signal_notes: r.signal_notes,
  }));
}

function ImportDialog({
  open, onOpenChange, onImport, busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (rows: ParsedCompetitor[]) => void;
  busy?: boolean;
}) {
  const [tab, setTab] = useState<"json" | "csv">("json");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo<ParsedCompetitor[]>(() => {
    if (!text.trim()) return [];
    try {
      setError(null);
      return tab === "json" ? parseJson(text) : parseCsv(text);
    } catch (e: any) {
      setError(e.message || "Parse error");
      return [];
    }
  }, [text, tab]);

  const valid = parsed.filter((r) => (r.name ?? "").trim());
  const skipped = parsed.length - valid.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import competitors</DialogTitle>
          <DialogDescription>
            Paste research output. All rows land as unverified drafts — a human still needs to click "Mark verified".
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="csv">CSV</TabsTrigger>
          </TabsList>
          <TabsContent value="json" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Array of objects with keys: <code>name</code> (required), <code>url</code>, <code>scope</code>, <code>pricing_text</code>, <code>pricing_model</code>, <code>source_url</code>, <code>signal_notes</code>.
            </p>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"name":"Acme Expediting","url":"https://...","scope":"local","pricing_text":"$500–$3,000/permit","pricing_model":"flat","source_url":"https://...","signal_notes":"BiggerPockets forum mention"}]' />
          </TabsContent>
          <TabsContent value="csv" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Header row required. Columns: name, url, scope, pricing_text, pricing_model, source_url, signal_notes.
            </p>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"name,url,scope,pricing_text,pricing_model,source_url,signal_notes\nAcme Expediting,https://acme.com,local,\"$500-$3,000/permit\",flat,https://source,BP forum"} />
          </TabsContent>
        </Tabs>

        {error && <div className="text-xs text-destructive">{error}</div>}

        {parsed.length > 0 && (
          <div className="border rounded-md text-xs">
            <div className="px-2 py-1 border-b bg-muted/50 flex justify-between">
              <span>{valid.length} valid · {skipped} skipped (missing name)</span>
              <span className="text-muted-foreground">preview first 5</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Model</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.slice(0, 5).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name || <span className="text-destructive">(missing)</span>}</TableCell>
                    <TableCell>{r.scope ?? "local"}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{r.pricing_text ?? "—"}</TableCell>
                    <TableCell>{r.pricing_model ?? "unknown"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || valid.length === 0} onClick={() => onImport(valid)}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Import {valid.length || ""} rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MarketCompetitorsSection({ market }: { market: Market }) {
  const { data: competitors = [], isLoading } = useMarketCompetitors(market.id);
  const add = useAddMarketCompetitor();
  const update = useUpdateMarketCompetitor();
  const verify = useVerifyMarketCompetitor();
  const del = useDeleteMarketCompetitor();
  const importMut = useImportMarketCompetitors();
  const { toast } = useToast();

  const [editing, setEditing] = useState<MarketCompetitor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MarketCompetitor | null>(null);

  const verifiedCount = competitors.filter((c) => c.verified_at).length;

  const handleSaveNew = async (v: EditState) => {
    try {
      await add.mutateAsync({ ...v, market_id: market.id });
      toast({ title: "Competitor added" });
      setAddOpen(false);
    } catch (e: any) {
      toast({ title: "Add failed", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveEdit = async (v: EditState) => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        market_id: market.id,
        name: v.name,
        url: v.url ?? null,
        scope: v.scope,
        pricing_text: v.pricing_text ?? null,
        pricing_model: v.pricing_model,
        source_url: v.source_url ?? null,
        signal_notes: v.signal_notes ?? null,
      });
      toast({ title: "Competitor updated" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleImport = async (rows: ParsedCompetitor[]) => {
    try {
      const res = await importMut.mutateAsync({ marketId: market.id, rows });
      toast({ title: `Imported ${res.inserted}`, description: `${res.inserted} drafted, review and verify${res.skipped ? ` · ${res.skipped} skipped` : ""}` });
      setImportOpen(false);
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competitors & Pricing</div>
          <div className="text-xs text-muted-foreground">
            {verifiedCount} verified / {competitors.length} total
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add competitor
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin" />
              </TableCell></TableRow>
            )}
            {!isLoading && competitors.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-4 text-sm text-muted-foreground">
                No competitors captured yet. Add manually or paste research from Perplexity/Claude.
              </TableCell></TableRow>
            )}
            {competitors.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                      {c.name} <LinkIcon className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ) : c.name}
                  {c.signal_notes && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.signal_notes}</div>
                  )}
                </TableCell>
                <TableCell><ScopeBadge scope={c.scope} /></TableCell>
                <TableCell className="text-sm max-w-[220px]">
                  <span className="whitespace-pre-wrap">{c.pricing_text || <span className="text-muted-foreground">—</span>}</span>
                </TableCell>
                <TableCell><ModelBadge model={c.pricing_model} /></TableCell>
                <TableCell><VerifiedBadge verified={!!c.verified_at} /></TableCell>
                <TableCell>
                  {c.source_url && (
                    <a href={c.source_url} target="_blank" rel="noreferrer" aria-label="source" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={c.verified_at ? "Unverify" : "Mark verified"}
                    onClick={() => verify.mutate({ id: c.id, market_id: market.id, verified: !c.verified_at })}
                  >
                    <ShieldCheck className={c.verified_at ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-muted-foreground"} />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setConfirmDelete(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CompetitorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        initial={{ name: "", scope: "local", pricing_model: "unknown" }}
        onSave={handleSaveNew}
        busy={add.isPending}
      />
      {editing && (
        <CompetitorDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing as EditState}
          onSave={handleSaveEdit}
          busy={update.isPending}
        />
      )}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        busy={importMut.isPending}
      />

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirmDelete) return;
                await del.mutateAsync({ id: confirmDelete.id, market_id: market.id });
                setConfirmDelete(null);
              }}
            >Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
