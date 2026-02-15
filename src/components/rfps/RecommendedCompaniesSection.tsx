import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, X, Search, Mail, Star } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useUpdateDiscoveredRfp, type DiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import { useToast } from "@/hooks/use-toast";
import { usePartnerRatings } from "@/hooks/usePartnerRatings";

interface Props {
  rfp: DiscoveredRfp;
  onEmailBlast?: (companyIds: string[]) => void;
}

export function RecommendedCompaniesSection({ rfp, onEmailBlast }: Props) {
  const { data: clients = [] } = useClients();
  const { data: ratings = {} } = usePartnerRatings();
  const update = useUpdateDiscoveredRfp();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [localIds, setLocalIds] = useState<string[]>(rfp.recommended_company_ids || []);

  const selectedIds = rfp.recommended_company_ids || [];

  // Sync local state when rfp data changes externally
  const rfpIds = rfp.recommended_company_ids;
  const [prevRfpIds, setPrevRfpIds] = useState(rfpIds);
  if (rfpIds !== prevRfpIds) {
    setPrevRfpIds(rfpIds);
    setLocalIds(rfpIds || []);
  }

  // Only show companies flagged as RFP partners, sorted by avg review rating
  const companyOptions = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter((c) => {
        if (!(c as any).is_rfp_partner) return false;
        if (q && !c.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const aSelected = localIds.includes(a.id) ? -1 : 1;
        const bSelected = localIds.includes(b.id) ? -1 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        const aRating = ratings[a.id] ?? 0;
        const bRating = ratings[b.id] ?? 0;
        if (bRating !== aRating) return bRating - aRating;
        return a.name.localeCompare(b.name);
      });
  }, [clients, search, localIds, ratings]);

  const selectedCompanies = clients.filter((c) => selectedIds.includes(c.id));

  const toggleLocal = (companyId: string) => {
    setLocalIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handleSave = async () => {
    setOpen(false);
    if (JSON.stringify(localIds.sort()) !== JSON.stringify([...selectedIds].sort())) {
      await update.mutateAsync({ id: rfp.id, recommended_company_ids: localIds } as any);
    }
  };

  const removeCompany = async (companyId: string) => {
    const next = selectedIds.filter((id) => id !== companyId);
    setLocalIds(next);
    await update.mutateAsync({ id: rfp.id, recommended_company_ids: next } as any);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Recommended Partners
        </Label>
        {selectedIds.length > 0 && onEmailBlast && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onEmailBlast(selectedIds)}
          >
            <Mail className="h-3 w-3 mr-1" /> Notify ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Selected chips */}
      {selectedCompanies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCompanies.map((c) => (
            <Badge key={c.id} variant="secondary" className="text-xs pl-2 pr-1 gap-1">
              {c.name}
              {c.client_type && (
                <span className="text-muted-foreground">· {c.client_type}</span>
              )}
              {ratings[c.id] != null && (
                <span className="text-muted-foreground flex items-center gap-0.5">
                  · <Star className="h-2.5 w-2.5 fill-accent text-accent" /> {ratings[c.id]!.toFixed(1)}
                </span>
              )}
              <button
                onClick={() => removeCompany(c.id)}
                className="hover:bg-muted rounded-full p-0.5 ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add companies popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs w-full">
            <Search className="h-3 w-3 mr-1" /> Add Partners
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search partners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <ScrollArea className="h-[240px]">
            <div className="p-1">
              {companyOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {search ? "No partners found" : "No companies flagged as RFP partners. Mark companies as partners in the Companies section."}
                </p>
              ) : (
                companyOptions.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={localIds.includes(c.id)}
                      onCheckedChange={() => toggleLocal(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                      <div className="flex items-center gap-2">
                        {c.client_type && (
                          <p className="text-[10px] text-muted-foreground">{c.client_type}</p>
                        )}
                        {ratings[c.id] != null && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5 fill-accent text-accent" /> {ratings[c.id]!.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="p-2 border-t">
            <Button size="sm" className="w-full h-8 text-xs" onClick={handleSave}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
