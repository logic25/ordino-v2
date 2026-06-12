import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Sparkles, Loader2, Globe2, Eye, Plus as PlusIcon,
} from "lucide-react";
import {
  useMarkets, useDeleteMarket, useUpdateMarket, useResearchMarket,
  type Market, type ChecklistItem,
} from "@/hooks/useMarkets";
import AddEditMarketDialog from "@/components/markets/AddEditMarketDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TIER_META: Record<1 | 2 | 3, { label: string; sub: string }> = {
  1: { label: "Tier 1", sub: "NYC (Five Boroughs)" },
  2: { label: "Tier 2", sub: "NYC-Adjacent / NY & NJ" },
  3: { label: "Tier 3", sub: "Out of State" },
};

function ModeBadge({ mode }: { mode: Market["mode"] }) {
  return mode === "proactive" ? (
    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Proactive</Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground">Reactive</Badge>
  );
}

function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const color = tier === 1
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : tier === 2
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
  return <Badge variant="outline" className={color}>T{tier}</Badge>;
}

function ScoreBar({ value }: { value: number | null }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-7 text-right">{v}</span>
    </div>
  );
}

function MarketDetailsCard({ market }: { market: Market }) {
  const update = useUpdateMarket();
  const research = useResearchMarket();
  const { toast } = useToast();
  const [notes, setNotes] = useState(market.notes ?? "");
  const [newItem, setNewItem] = useState("");

  const checklist: ChecklistItem[] = Array.isArray(market.checklist) ? market.checklist : [];

  const toggleItem = (id: string) => {
    const next = checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    update.mutate({ id: market.id, checklist: next });
  };
  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    const next = [...checklist, { id: crypto.randomUUID(), label, done: false }];
    update.mutate({ id: market.id, checklist: next });
    setNewItem("");
  };
  const removeItem = (id: string) => {
    update.mutate({ id: market.id, checklist: checklist.filter((c) => c.id !== id) });
  };

  const saveNotes = () => {
    if ((notes ?? "") === (market.notes ?? "")) return;
    update.mutate({ id: market.id, notes: notes.trim() || null });
  };

  const handleResearch = async () => {
    try {
      await research.mutateAsync({ id: market.id, name: market.name, state: market.state, tier: market.tier });
      toast({ title: "Research complete" });
    } catch (e: any) {
      toast({ title: "Research failed", description: e.message, variant: "destructive" });
    }
  };

  const intel = market.intel ?? {};

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{market.name}</h3>
            <TierBadge tier={market.tier} />
            <ModeBadge mode={market.mode} />
            <span className="text-xs text-muted-foreground">{market.state}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleResearch} disabled={research.isPending}>
          {research.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Research with AI
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Checklist */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase checklist</div>
          <p className="text-xs text-muted-foreground -mt-1">Concrete steps to make this market operational — e.g. "Register with NJ DCA", "Hire local expeditor", "Set up DOB NOW account".</p>
          {checklist.length === 0 && <div className="text-sm text-muted-foreground italic">No items yet.</div>}
          <ul className="space-y-1.5">
            {checklist.map((item) => (
              <li key={item.id} className="group flex items-center gap-2">
                <Checkbox checked={item.done} onCheckedChange={() => toggleItem(item.id)} />
                <span className={cn("text-sm flex-1", item.done && "line-through text-muted-foreground")}>{item.label}</span>
                <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100" aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add checklist item"
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} className="h-8" />
            <Button size="sm" variant="outline" onClick={addItem}><PlusIcon className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} rows={5}
            placeholder="Internal notes about this market…" />
        </div>
      </div>

      {/* Intel */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Research</div>
          {intel.warning && <span className="text-xs text-amber-700">{intel.warning}</span>}
        </div>
        {!intel.why_it_matters && !intel.requirements && !intel.key_contacts && !intel.competitive_landscape && !intel.raw && (
          <div className="text-sm text-muted-foreground italic">No research yet. Click "Research with AI" to generate.</div>
        )}
        {intel.why_it_matters && <IntelBlock label="Why it matters" text={intel.why_it_matters} />}
        {intel.requirements && <IntelBlock label="Requirements" text={intel.requirements} />}
        {intel.key_contacts && <IntelBlock label="Key contacts" text={intel.key_contacts} />}
        {intel.competitive_landscape && <IntelBlock label="Competitive landscape" text={intel.competitive_landscape} />}
        {intel.raw && !intel.why_it_matters && (
          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">{intel.raw}</pre>
        )}
      </div>
    </Card>
  );
}

function IntelBlock({ label, text }: { label: string; text: string }) {
  return (
    <details className="group" open>
      <summary className="cursor-pointer text-sm font-medium">{label}</summary>
      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>
    </details>
  );
}

export default function Markets() {
  const { data: markets = [], isLoading } = useMarkets();
  const del = useDeleteMarket();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Market | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Market | null>(null);

  const summary = useMemo(() => {
    const byTier: Record<1 | 2 | 3, { total: number; proactive: number; reactive: number }> = {
      1: { total: 0, proactive: 0, reactive: 0 },
      2: { total: 0, proactive: 0, reactive: 0 },
      3: { total: 0, proactive: 0, reactive: 0 },
    };
    markets.forEach((m) => {
      const t = (m.tier as 1 | 2 | 3) ?? 1;
      byTier[t].total++;
      if (m.mode === "proactive") byTier[t].proactive++;
      else byTier[t].reactive++;
    });
    return byTier;
  }, [markets]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (m: Market) => { setEditing(m); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast({ title: "Market removed" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Globe2 className="h-6 w-6 text-primary" /> Markets
            </h1>
            <p className="text-sm text-muted-foreground">Where we file today, where we're ramping up, and where we're out of state.</p>
          </div>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Market</Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([1, 2, 3] as const).map((t) => (
                <Card key={t} className="p-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{TIER_META[t].label}</div>
                      <div className="text-sm font-semibold">{TIER_META[t].sub}</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{summary[t].total}</div>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span><span className="font-semibold text-emerald-700">{summary[t].proactive}</span> proactive</span>
                    <span><span className="font-semibold text-foreground">{summary[t].reactive}</span> reactive</span>
                  </div>
                </Card>
              ))}
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Op. Score</TableHead>
                    <TableHead>Comm. Score</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      <Loader2 className="inline h-4 w-4 animate-spin" />
                    </TableCell></TableRow>
                  )}
                  {!isLoading && markets.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No markets yet. Click "Add Market" to start.
                    </TableCell></TableRow>
                  )}
                  {markets.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.state}</TableCell>
                      <TableCell><TierBadge tier={m.tier} /></TableCell>
                      <TableCell><ModeBadge mode={m.mode} /></TableCell>
                      <TableCell><ScoreBar value={m.operational_score} /></TableCell>
                      <TableCell><ScoreBar value={m.commercial_score} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(m)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* DETAILS */}
          <TabsContent value="details" className="space-y-3">
            {isLoading && <div className="text-center py-8"><Loader2 className="inline h-5 w-5 animate-spin" /></div>}
            {!isLoading && markets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No markets yet.</div>
            )}
            {markets.map((m) => <MarketDetailsCard key={m.id} market={m} />)}
          </TabsContent>
        </Tabs>
      </div>

      <AddEditMarketDialog open={dialogOpen} onOpenChange={setDialogOpen} market={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the market and its checklist/intel.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
