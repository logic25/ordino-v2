import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, X, Search, Sparkles, Mail, Loader2, Star } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useUpdateDiscoveredRfp, type DiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import { useToast } from "@/hooks/use-toast";

interface Props {
  rfp: DiscoveredRfp;
  onEmailBlast?: (companyIds: string[]) => void;
}

export function RecommendedCompaniesSection({ rfp, onEmailBlast }: Props) {
  const { data: clients = [] } = useClients();
  const update = useUpdateDiscoveredRfp();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selectedIds = rfp.recommended_company_ids || [];

  // Filter to architect-type companies and sort by name
  const companyOptions = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter((c) => {
        if (q && !c.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        // Selected companies first
        const aSelected = selectedIds.includes(a.id) ? -1 : 1;
        const bSelected = selectedIds.includes(b.id) ? -1 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        return a.name.localeCompare(b.name);
      });
  }, [clients, search, selectedIds]);

  const selectedCompanies = clients.filter((c) => selectedIds.includes(c.id));

  const toggleCompany = async (companyId: string) => {
    const next = selectedIds.includes(companyId)
      ? selectedIds.filter((id) => id !== companyId)
      : [...selectedIds, companyId];
    await update.mutateAsync({ id: rfp.id, recommended_company_ids: next } as any);
  };

  const removeCompany = async (companyId: string) => {
    const next = selectedIds.filter((id) => id !== companyId);
    await update.mutateAsync({ id: rfp.id, recommended_company_ids: next } as any);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Recommended Companies
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
            <Search className="h-3 w-3 mr-1" /> Add Companies
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <ScrollArea className="h-[240px]">
            <div className="p-1">
              {companyOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No companies found</p>
              ) : (
                companyOptions.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.includes(c.id)}
                      onCheckedChange={() => toggleCompany(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                      {c.client_type && (
                        <p className="text-[10px] text-muted-foreground">{c.client_type}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
