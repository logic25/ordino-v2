import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Sparkles, BookOpen, BookPlus, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  useUpdateMarket,
  type Market,
  type MarketService,
} from "@/hooks/useMarkets";
import { usePlaybooksForMarket, useCreatePlaybook, type PermitPlaybook } from "@/hooks/usePermitPlaybooks";
import { useAuth } from "@/hooks/useAuth";
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
  const createPlaybook = useCreatePlaybook();
  const { data: playbooks = [] } = usePlaybooksForMarket(market.id);
  const { profile } = useAuth();
  const { toast } = useToast();
  const services = market.services ?? [];
  const [addingCat, setAddingCat] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const playbookById = useMemo(
    () => new Map(playbooks.map((p) => [p.id, p])),
    [playbooks],
  );
  const playbookByLabel = useMemo(() => {
    const m = new Map<string, PermitPlaybook>();
    for (const p of playbooks) m.set(p.permit_type.trim().toLowerCase(), p);
    return m;
  }, [playbooks]);

  const resolvePlaybook = (s: MarketService): PermitPlaybook | null => {
    if (s.playbook_id) return playbookById.get(s.playbook_id) ?? null;
    return playbookByLabel.get(s.label.trim().toLowerCase()) ?? null;
  };

  // Is the linked playbook fully human-verified? Uses last_verified_at, which
  // usePermitPlaybooks only sets when every slot is human-verified. This is the
  // AI-vs-human contract: AI drafts alone can never satisfy this.
  const isPlaybookFullyVerified = (pb: PermitPlaybook | null): boolean =>
    !!pb && pb.qa.length > 0 && !!pb.last_verified_at;

  const save = async (next: MarketService[]) => {
    try {
      await update.mutateAsync({ id: market.id, services: next });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const seed = () => save(defaultServices());

  // ── Verification integrity: any edit that changes the underlying data
  //    invalidates a prior verification. Downstream code trusts verified_at,
  //    so we must never leave a stale "verified" pointing at edited data.
  const clearVerification = <T extends Partial<MarketService>>(patch: T): T => ({
    ...patch,
    verified_at: null,
    verified_by: null,
  });

  const toggleOffered = (id: string) =>
    save(services.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, offered: !s.offered };
      // Turning a service off invalidates its verified status — it's no longer
      // a claim we're making. Turning it on requires re-verifying.
      return { ...next, verified_at: null, verified_by: null };
    }));

  const updateField = (id: string, patch: Partial<MarketService>) =>
    save(services.map((s) => {
      if (s.id !== id) return s;
      // Only editable-data patches invalidate verification. Callers passing
      // verified_at/verified_by directly (verify / unverify) skip this branch.
      const editsData =
        "suggested_fee" in patch ||
        "county_fee_note" in patch ||
        "label" in patch ||
        "playbook_id" in patch ||
        "note" in patch;
      return editsData ? { ...s, ...clearVerification(patch) } : { ...s, ...patch };
    }));

  const removeService = (id: string) =>
    save(services.filter((s) => s.id !== id));

  const markVerified = (s: MarketService) => {
    if (!s.offered) {
      toast({ title: "Turn the service on first", description: "Only offered services can be marked verified." });
      return;
    }
    if (!s.suggested_fee.trim()) {
      toast({ title: "Add a fee first", description: "Verification requires a GLE fee on the row." });
      return;
    }
    save(services.map((x) => (x.id === s.id ? {
      ...x,
      verified_at: new Date().toISOString(),
      verified_by: profile?.id ?? null,
    } : x)));
    toast({ title: "Service verified", description: `"${s.label}" is now authoritative for downstream use.` });
  };

  const unverify = (s: MarketService) =>
    save(services.map((x) => (x.id === s.id ? { ...x, verified_at: null, verified_by: null } : x)));

  // Auto-flip: once per market load, promote any service whose linked playbook
  // is fully human-verified AND has a fee — as long as it's not already verified
  // and isn't already stale (edited since). Runs at most once per services array.
  useEffect(() => {
    if (services.length === 0) return;
    let dirty = false;
    const next = services.map((s) => {
      if (s.verified_at) return s;
      if (!s.offered) return s;
      if (!s.suggested_fee.trim()) return s;
      const pb = resolvePlaybook(s);
      if (!isPlaybookFullyVerified(pb)) return s;
      dirty = true;
      return { ...s, verified_at: new Date().toISOString(), verified_by: profile?.id ?? null };
    });
    if (dirty) save(next);
    // Intentionally narrow deps — we want this to react to playbook verification
    // changes and to the services array itself, not to every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbooks, market.id]);

  const draftPlaybookFor = async (s: MarketService) => {
    try {
      const pb = await createPlaybook.mutateAsync({
        market_id: market.id,
        permit_type: s.label,
      });
      // Link but do NOT verify — a fresh playbook has zero verified slots.
      await save(services.map((x) => (x.id === s.id ? { ...x, playbook_id: pb.id } : x)));
      toast({ title: "Playbook drafted", description: `Created a blank playbook for "${s.label}".` });
    } catch (e: any) {
      toast({ title: "Could not draft playbook", description: e.message, variant: "destructive" });
    }
  };




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
            {items.map((s) => {
              const pb = resolvePlaybook(s);
              const verified = pb ? pb.qa.filter((q) => q.verified).length : 0;
              const total = pb ? pb.qa.length : 0;
              const fullyVerified = pb && total > 0 && verified === total;
              return (
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
                    {s.verified_at ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"
                        title={`Verified ${new Date(s.verified_at).toLocaleDateString()}${s.verified_by ? " — human confirmed" : ""}`}
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-muted text-muted-foreground gap-1"
                        title="Not yet verified — downstream tools (proposals, PM briefs, Beacon) will flag this as a guess."
                      >
                        <ShieldAlert className="h-2.5 w-2.5" />
                        Unverified
                      </Badge>
                    )}
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
                  <div className="flex items-center gap-2 pt-0.5">
                    {pb ? (
                      <>
                        <Link
                          to={`/markets/${market.id}/playbooks/${pb.id}`}
                          className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                        >
                          <BookOpen className="h-3 w-3" />
                          Playbook
                        </Link>
                        <Badge
                          variant="outline"
                          className={
                            fullyVerified
                              ? "text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {verified}/{total} verified
                        </Badge>
                        {!s.playbook_id && (
                          <button
                            type="button"
                            onClick={() => updateField(s.id, { playbook_id: pb.id })}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted"
                            title="Match found by name — click to lock this link"
                          >
                            link
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => draftPlaybookFor(s)}
                        disabled={createPlaybook.isPending}
                        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
                      >
                        <BookPlus className="h-3 w-3" />
                        Draft playbook
                      </button>
                    )}
                    <span className="flex-1" />
                    {s.verified_at ? (
                      <button
                        type="button"
                        onClick={() => unverify(s)}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
                        title="Clear verification — mark as needs review"
                      >
                        Unverify
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markVerified(s)}
                        disabled={!s.offered || !s.suggested_fee.trim()}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                        title={
                          !s.offered
                            ? "Turn the service on first"
                            : !s.suggested_fee.trim()
                            ? "Add a fee first"
                            : "Mark this service as verified — proposals and Beacon may quote it authoritatively"
                        }
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Mark verified
                      </button>
                    )}
                  </div>
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
              );
            })}
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
