import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgencyComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

function useAgencies() {
  return useQuery({
    queryKey: ["rfp-agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfps")
        .select("agency")
        .not("agency", "is", null)
        .order("agency");
      if (error) throw error;
      const unique = [...new Set(data.map((r) => r.agency).filter(Boolean))] as string[];
      return unique;
    },
  });
}

export function AgencyCombobox({ value, onChange }: AgencyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newAgency, setNewAgency] = useState("");
  const { data: agencies = [] } = useAgencies();
  const qc = useQueryClient();

  const handleAddNew = () => {
    if (!newAgency.trim()) return;
    onChange(newAgency.trim());
    // Invalidate so it shows up next time
    qc.invalidateQueries({ queryKey: ["rfp-agencies"] });
    setNewAgency("");
    setAddOpen(false);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-9"
          >
            {value || "Select agency..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search agencies..." />
            <CommandList>
              <CommandEmpty>No agency found.</CommandEmpty>
              <CommandGroup>
                {agencies.map((agency) => (
                  <CommandItem
                    key={agency}
                    value={agency}
                    onSelect={() => {
                      onChange(agency);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === agency ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {agency}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setAddOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Agency
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Agency</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Agency Name</Label>
              <Input
                value={newAgency}
                onChange={(e) => setNewAgency(e.target.value)}
                placeholder="e.g. NYC Department of Buildings"
                onKeyDown={(e) => e.key === "Enter" && handleAddNew()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNew} disabled={!newAgency.trim()}>
              Add Agency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
