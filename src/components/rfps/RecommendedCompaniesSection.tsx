import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, X, Search, Mail, Star, Sparkles, User } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useUpdateDiscoveredRfp, type DiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import { useToast } from "@/hooks/use-toast";
import { usePartnerRatings } from "@/hooks/usePartnerRatings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  rfp: DiscoveredRfp;
  onEmailBlast?: (companyIds: string[]) => void;
}

// Fetch contacts for partner companies
function usePartnerContacts(clientIds: string[]) {
  return useQuery({
    queryKey: ["partner-contacts", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("id, name, email, client_id, is_primary, title")
        .in("client_id", clientIds)
        .order("is_primary", { ascending: false })
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
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

  const allPartnerIds = useMemo(
    () => clients.filter((c) => (c as any).is_rfp_partner).map((c) => c.id),
    [clients]
  );

  const { data: contacts = [] } = usePartnerContacts(allPartnerIds);

  // Build a map: client_id -> primary contact (or first contact)
  const contactByClient = useMemo(() => {
    const map: Record<string, { name: string; email: string | null; title: string | null }> = {};
    for (const c of contacts) {
      if (!map[c.client_id] || c.is_primary) {
        map[c.client_id] = { name: c.name, email: c.email, title: c.title };
      }
    }
    return map;
  }, [contacts]);

  const selectedCompanies = clients.filter((c) => selectedIds.includes(c.id));

  // AI-suggested partners: top-rated partners with rating >= 3.5 that aren't already selected
  const aiSuggested = useMemo(() => {
    if (selectedIds.length > 0) return []; // Only suggest when none selected
    return companyOptions
      .filter((c) => (ratings[c.id] ?? 0) >= 3.5 && !selectedIds.includes(c.id))
      .slice(0, 3);
  }, [companyOptions, ratings, selectedIds]);

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

  const handleAddSuggested = async () => {
    const suggestedIds = aiSuggested.map((c) => c.id);
    const merged = [...new Set([...selectedIds, ...suggestedIds])];
    setLocalIds(merged);
    await update.mutateAsync({ id: rfp.id, recommended_company_ids: merged } as any);
    toast({ title: "AI suggestions added", description: `Added ${suggestedIds.length} top-rated partners.` });
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

      {/* AI Suggestions */}
      {aiSuggested.length > 0 && selectedIds.length === 0 && (
        <div className="rounded-md border border-accent/30 bg-accent/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium flex items-center gap-1 text-accent">
              <Sparkles className="h-3 w-3" /> Suggested Partners
            </p>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-accent" onClick={handleAddSuggested}>
              Add All
            </Button>
          </div>
          <div className="space-y-1">
            {aiSuggested.map((c) => {
              const contact = contactByClient[c.id];
              return (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    {contact && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" /> {contact.name}{contact.title ? ` · ${contact.title}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                    <Star className="h-2.5 w-2.5 fill-accent text-accent" /> {ratings[c.id]!.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected chips */}
      {selectedCompanies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCompanies.map((c) => {
            const contact = contactByClient[c.id];
            return (
              <Badge key={c.id} variant="secondary" className="text-xs pl-2 pr-1 gap-1">
                <div className="flex flex-col leading-tight">
                  <span>{c.name}</span>
                  {contact && (
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {contact.name}{contact.title ? ` · ${contact.title}` : ""}
                    </span>
                  )}
                </div>
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
            );
          })}
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
                companyOptions.map((c) => {
                  const contact = contactByClient[c.id];
                  return (
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {contact && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <User className="h-2.5 w-2.5" /> {contact.name}
                            </p>
                          )}
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
                  );
                })
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
