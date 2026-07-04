import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useCreateMarket, useUpdateMarket, type Market, type MarketTier, type MarketMode } from "@/hooks/useMarkets";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  market?: Market | null;
};

const US_STATES = ["NY", "NJ", "CT", "PA", "MA", "FL", "CA", "TX"];

function FieldLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm">{children}</Label>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="Help">
              <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function AddEditMarketDialog({ open, onOpenChange, market }: Props) {
  const { toast } = useToast();
  const create = useCreateMarket();
  const update = useUpdateMarket();

  const [name, setName] = useState("");
  const [state, setState] = useState("NY");
  const [tier, setTier] = useState<MarketTier>(1);
  const [mode, setMode] = useState<MarketMode>("reactive");
  const [op, setOp] = useState(50);
  const [comm, setComm] = useState(50);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(market?.name ?? "");
      setState(market?.state ?? "NY");
      setTier((market?.tier as MarketTier) ?? 1);
      setMode((market?.mode as MarketMode) ?? "reactive");
      setOp(market?.operational_score ?? 50);
      setComm(market?.commercial_score ?? 50);
      setNotes(market?.notes ?? "");
    }
  }, [open, market]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        name: name.trim(), state, tier, mode,
        operational_score: op, commercial_score: comm,
        notes: notes.trim() || null,
      };
      if (market) {
        await update.mutateAsync({ id: market.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      toast({ title: market ? "Market updated" : "Market added" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{market ? "Edit market" : "Add market"}</DialogTitle>
          <DialogDescription>Track where GLE can take work and where we're actively selling.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Market name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nassau County" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel tip="Tier 1 = NYC five boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island) — our home turf. Tier 2 = NYC-adjacent NY/NJ counties where we can ramp up. Tier 3 = out-of-state, requires licensure or a local partner.">
                Tier
              </FieldLabel>
              <Select value={String(tier)} onValueChange={(v) => setTier(Number(v) as MarketTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — NYC (Five Boroughs)</SelectItem>
                  <SelectItem value="2">2 — NYC-Adjacent / NY & NJ</SelectItem>
                  <SelectItem value="3">3 — Out of State</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel tip="Reactive = we accept work when it comes to us. Proactive = we are actively marketing and selling here.">
              Mode
            </FieldLabel>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === "reactive" ? "default" : "outline"} onClick={() => setMode("reactive")} className="flex-1">Reactive</Button>
              <Button type="button" size="sm" variant={mode === "proactive" ? "default" : "outline"} onClick={() => setMode("proactive")} className="flex-1">Proactive</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel tip="Can we actually manage the filing process here? 100 = we've done it many times. 0 = no knowledge of local requirements.">
                Operational Score
              </FieldLabel>
              <span className="text-sm font-medium tabular-nums">{op}</span>
            </div>
            <Slider value={[op]} min={0} max={100} step={1} onValueChange={(v) => setOp(v[0])} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel tip="Are we actively selling here? 100 = dedicated BD effort. 0 = no outreach.">
                Commercial Score
              </FieldLabel>
              <span className="text-sm font-medium tabular-nums">{comm}</span>
            </div>
            <Slider value={[comm]} min={0} max={100} step={1} onValueChange={(v) => setComm(v[0])} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : market ? "Save changes" : "Add market"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
