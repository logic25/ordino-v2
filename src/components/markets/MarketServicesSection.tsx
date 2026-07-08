import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Sparkles, BookOpen, BookPlus } from "lucide-react";
import {
  useUpdateMarket,
  type Market,
  type MarketService,
} from "@/hooks/useMarkets";
import { usePlaybooksForMarket, useCreatePlaybook } from "@/hooks/usePermitPlaybooks";
import { useToast } from "@/hooks/use-toast";

// ── Default catalog GLE offers in any US jurisdiction ─────────────────────────
// Whether the JURISDICTION accepts third-party plan review is tracked at the
// market level (see MarketPeerReviewSection), not per service line.
function defaultServices(): MarketService[] {
  const mk = (
    category: string,
    label: string,
    suggested_fee: string,
    county_fee_note?: string,
    note?: string,
  ): MarketService => ({
    id: crypto.randomUUID(),
    category,
    label,
    suggested_fee,
    offered: true,
    county_fee_note,
    note,
  });

  return [
    // Building
    mk("Building", "New Commercial Building Permit", "$5,000–$15,000 flat or 10–12% of county fee", "Valuation-based + ~65% plan review"),
    mk("Building", "Commercial Alteration / Tenant Fit-out", "$2,500–$6,000 flat", "Min ~$150 + valuation-based"),
    mk("Building", "Change of Use / Occupancy", "$2,000–$4,000", "Building fee + zoning review"),
    mk("Building", "Shell & Core Permit", "$6,000–$12,000", "Valuation-based"),
    mk("Building", "Sign Permit", "$500–$1,200 per sign", "~$85–$300 per sign"),
    mk("Building", "Demolition Permit", "$750–$1,500", "~$150–$500"),
    mk("Building", "Certificate of Occupancy", "$1,500–$3,000"),

    // Trade
    mk("Trade", "Electrical Permit Coordination", "$500–$1,500", "~$60 + per-fixture"),
    mk("Trade", "Plumbing Permit Coordination", "$500–$1,500", "~$60 + per-fixture"),
    mk("Trade", "Mechanical / HVAC Coordination", "$500–$1,500", "Valuation-based"),
    mk("Trade", "Fire Protection (Sprinkler/Alarm)", "$1,000–$2,500", "Reviewed by Fire Marshal separately"),

    // Site / Land Development
    mk("Site / Land Development", "Site Plan / Grading Permit", "$8,000–$20,000"),
    mk("Site / Land Development", "Stormwater Management Plan", "$5,000–$12,000"),
    mk("Site / Land Development", "Erosion & Sediment Control", "$2,500–$5,000"),
  ];
}

export default function MarketServicesSection({ market }: { market: Market }) {
  const update = useUpdateMarket();
  const { toast } = useToast();
  const services = market.services ?? [];
  const [addingCat, setAddingCat] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const save = async (next: MarketService[]) => {
    try {
      await update.mutateAsync({ id: market.id, services: next });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const seed = () => save(defaultServices());

  const toggleOffered = (id: string) =>
    save(services.map((s) => (s.id === id ? { ...s, offered: !s.offered } : s)));

  const updateField = (id: string, patch: Partial<MarketService>) =>
    save(services.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeService = (id: string) =>
    save(services.filter((s) => s.id !== id));

  const addService = (category: string) => {
    const label = newLabel.trim();
    if (!label) return;
    const next: MarketService = {
      id: crypto.randomUUID(),
      category,
      label,
      suggested_fee: "",
      offered: true,
      peer_review_required: false,
    };
    save([...services, next]);
    setNewLabel("");
    setAddingCat(null);
  };

  const grouped = useMemo(() => {
    const g: Record<string, MarketService[]> = {};
    for (const s of services) (g[s.category] ??= []).push(s);
    return g;
  }, [services]);

  const offeredCount = services.filter((s) => s.offered).length;

  if (services.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Services offered in this market
        </div>
        <p className="text-sm text-muted-foreground">
          No services configured yet. Seed the default catalog (Building, Trade, Site/Land Development) to get started.
        </p>
        <Button size="sm" onClick={seed} disabled={update.isPending}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Seed default service catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Services offered ({offeredCount} of {services.length})
        </div>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{cat}</div>
          <div className="rounded-md border divide-y">
            {items.map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-2.5">
                <div className="pt-0.5">
                  <Switch
                    checked={s.offered}
                    onCheckedChange={() => toggleOffered(s.id)}
                    aria-label={`Offer ${s.label}`}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-medium ${s.offered ? "" : "text-muted-foreground line-through"}`}>
                      {s.label}
                    </span>
                    {!s.offered && (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                        Not offered
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={s.suggested_fee}
                      onChange={(e) => updateField(s.id, { suggested_fee: e.target.value })}
                      placeholder="GLE fee (e.g. $2,500–$6,000)"
                      className="h-7 text-xs"
                    />
                    <Input
                      value={s.county_fee_note ?? ""}
                      onChange={(e) => updateField(s.id, { county_fee_note: e.target.value })}
                      placeholder="County/jurisdiction fee note"
                      className="h-7 text-xs"
                    />
                  </div>
                  {s.note && <div className="text-[11px] text-muted-foreground">{s.note}</div>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeService(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {addingCat === cat ? (
              <div className="flex items-center gap-2 p-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="New service name…"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addService(cat);
                    if (e.key === "Escape") { setAddingCat(null); setNewLabel(""); }
                  }}
                  autoFocus
                />
                <Button size="sm" className="h-7" onClick={() => addService(cat)}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingCat(null); setNewLabel(""); }}>Cancel</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCat(cat)}
                className="w-full flex items-center gap-1.5 p-2 text-xs text-muted-foreground hover:bg-muted/50"
              >
                <Plus className="h-3 w-3" /> Add service to {cat}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
