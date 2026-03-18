import React, { useState, useRef } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useProperties, useCreateProperty, useUpdateProperty } from "@/hooks/useProperties";
import { useNYCPropertyLookup } from "@/hooks/useNYCPropertyLookup";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { ProposalContactsSection } from "@/components/proposals/ProposalContactsSection";
import { SectionLabel } from "./DialogHelpers";
import type { ProposalContactInput } from "@/hooks/useProposalContacts";

interface PropertyContactsStepProps {
  form: any;
  contacts: ProposalContactInput[];
  onContactsChange: (contacts: ProposalContactInput[]) => void;
}

export function PropertyContactsStep({ form, contacts, onContactsChange }: PropertyContactsStepProps) {
  const { data: properties = [] } = useProperties();
  const { data: clients = [] } = useClients();
  const createClient = useCreateClient();
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const { lookupByAddress } = useNYCPropertyLookup();
  const { toast } = useToast();

  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<Array<{ label: string; borough: string; zip: string }>>([]);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const selectedProperty = properties.find(p => p.id === form.watch("property_id"));

  const handleCreateProperty = async (address: string) => {
    try {
      const newProp = await createProperty.mutateAsync({ address });
      form.setValue("property_id", newProp.id);
      setPropertySearch("");
      setPropertyOpen(false);
      setGeoSuggestions([]);
      toast({ title: "Property created", description: `Looking up NYC data for "${address}"…` });

      const nycData = await lookupByAddress(address);
      if (nycData) {
        const updates: Record<string, any> = {};
        if (nycData.borough) updates.borough = nycData.borough;
        if (nycData.block) updates.block = nycData.block;
        if (nycData.lot) updates.lot = nycData.lot;
        if (nycData.bin) updates.bin = nycData.bin;
        if (nycData.zip_code) updates.zip_code = nycData.zip_code;
        if (nycData.owner_name) updates.owner_name = nycData.owner_name;
        if (Object.keys(updates).length > 0) {
          await updateProperty.mutateAsync({ id: newProp.id, address: newProp.address, ...updates });
          const bbl = [nycData.borough, nycData.block ? `Block ${nycData.block}` : null, nycData.lot ? `Lot ${nycData.lot}` : null].filter(Boolean).join(" · ");
          toast({ title: "✓ NYC Data Found", description: bbl || "Property enriched." });
        }
      } else {
        toast({ title: "No NYC data found", description: "BBL could not be determined — you can edit the property later.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="px-6 py-5 space-y-5">
      <div className="space-y-4">
        <SectionLabel>Property Address</SectionLabel>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Property *</Label>
          <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10 text-sm">
                {selectedProperty ? (
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{selectedProperty.address}</span>
                    {selectedProperty.borough && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({selectedProperty.borough}{selectedProperty.block ? ` · Blk ${selectedProperty.block}` : ""}{selectedProperty.lot ? ` · Lot ${selectedProperty.lot}` : ""})
                      </span>
                    )}
                  </span>
                ) : "Search or enter a property address…"}
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command shouldFilter={true}>
                <CommandInput placeholder="Type an address…" value={propertySearch} onValueChange={(val) => {
                  setPropertySearch(val);
                  if (geoDebounceRef.current) clearTimeout(geoDebounceRef.current);
                  if (val.length >= 3) {
                    geoDebounceRef.current = setTimeout(async () => {
                      try {
                        const resp = await fetch(`https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(val)}`);
                        if (resp.ok) {
                          const data = await resp.json();
                          setGeoSuggestions((data?.features || []).slice(0, 4).map((f: any) => ({
                            label: f.properties?.label || f.properties?.name || "",
                            borough: f.properties?.borough || "",
                            zip: f.properties?.postalcode || "",
                          })));
                        }
                      } catch { /* silent */ }
                    }, 250);
                  } else {
                    setGeoSuggestions([]);
                  }
                }} />
                <CommandList>
                  <CommandEmpty className="p-0">
                    {geoSuggestions.length > 0 ? (
                      <div className="border-b">
                        <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">NYC Address Suggestions</p>
                        {geoSuggestions.map((s, i) => (
                          <button key={i} type="button" className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
                            onClick={() => handleCreateProperty(s.label)}>
                            <Plus className="h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="truncate">{s.label}</div>
                              {s.borough && <div className="text-xs text-muted-foreground">{s.borough}{s.zip ? ` · ${s.zip}` : ""}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button type="button" className="w-full px-4 py-3 text-sm text-left hover:bg-muted flex items-center gap-2"
                        onClick={() => propertySearch.trim() && handleCreateProperty(propertySearch.trim())}>
                        <Plus className="h-4 w-4" />
                        Add "{propertySearch}" as new property
                      </button>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {properties.map((p) => (
                      <CommandItem key={p.id} value={p.address} onSelect={() => {
                        form.setValue("property_id", p.id);
                        setPropertySearch("");
                        setPropertyOpen(false);
                        setGeoSuggestions([]);
                      }}>
                        <Check className={cn("mr-2 h-4 w-4", form.watch("property_id") === p.id ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{p.address}</span>
                        {p.borough && <span className="text-xs text-muted-foreground ml-1">({p.borough})</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {form.formState.errors.property_id && (
            <p className="text-xs text-destructive">{form.formState.errors.property_id.message}</p>
          )}
        </div>

        {selectedProperty && (selectedProperty.borough || selectedProperty.bin) && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex items-center gap-4 flex-wrap">
              {selectedProperty.borough && <span><span className="text-muted-foreground">Borough:</span> {selectedProperty.borough}</span>}
              {selectedProperty.block && <span><span className="text-muted-foreground">Block:</span> {selectedProperty.block}</span>}
              {selectedProperty.lot && <span><span className="text-muted-foreground">Lot:</span> {selectedProperty.lot}</span>}
              {selectedProperty.bin && <span><span className="text-muted-foreground">BIN:</span> {selectedProperty.bin}</span>}
              {selectedProperty.zip_code && <span><span className="text-muted-foreground">Zip:</span> {selectedProperty.zip_code}</span>}
            </div>
            {selectedProperty.owner_name && (
              <div><span className="text-muted-foreground">Owner:</span> {selectedProperty.owner_name}</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Proposal Title *</Label>
            <Input className="h-10 text-sm" placeholder="e.g., Full Permit Package — 228 Greene Ave" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Apt / Unit</Label>
            <Input className="h-10 text-sm" placeholder="e.g., 46C" {...form.register("unit_number")} />
          </div>
        </div>
      </div>

      <SectionLabel>Contacts</SectionLabel>
      <p className="text-xs text-muted-foreground -mt-1">
        Add the people involved — who you're billing, who signs, and who is the applicant.
      </p>
      <ProposalContactsSection
        contacts={contacts}
        onChange={onContactsChange}
        clients={clients}
        onAddClient={async (data) => {
          try {
            const newClient = await createClient.mutateAsync(data);
            return newClient;
          } catch (err: any) {
            toast({ title: "Error creating company", description: err?.message || "Please try again.", variant: "destructive" });
            throw err;
          }
        }}
        isAddingClient={createClient.isPending}
      />
    </div>
  );
}
