import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useGlobalSearch, type GlobalSearchHit, type GlobalSearchKind } from "@/hooks/useGlobalSearch";
import { Briefcase, Building2, FileText, Sparkles, Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_META: Record<GlobalSearchKind, { label: string; icon: any }> = {
  lead: { label: "Leads", icon: Sparkles },
  proposal: { label: "Proposals", icon: FileText },
  client: { label: "Clients", icon: Users },
  project: { label: "Projects", icon: Briefcase },
  property: { label: "Properties", icon: Building2 },
};

const KIND_ORDER: GlobalSearchKind[] = ["lead", "proposal", "client", "project", "property"];

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data: hits = [], isFetching } = useGlobalSearch(query);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const grouped = useMemo(() => {
    const g: Record<GlobalSearchKind, GlobalSearchHit[]> = {
      lead: [], proposal: [], client: [], project: [], property: [],
    };
    for (const h of hits) g[h.kind]?.push(h);
    return g;
  }, [hits]);

  const handleSelect = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search leads, proposals, clients, projects, properties…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </div>
        ) : isFetching && hits.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
        ) : hits.length === 0 ? (
          <CommandEmpty>No matches found.</CommandEmpty>
        ) : (
          KIND_ORDER.map((kind, idx) => {
            const items = grouped[kind];
            if (!items.length) return null;
            const { label, icon: Icon } = KIND_META[kind];
            return (
              <div key={kind}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={label}>
                  {items.map((h) => (
                    <CommandItem
                      key={`${h.kind}-${h.id}`}
                      value={`${h.kind}-${h.id}-${h.title}`}
                      onSelect={() => handleSelect(h.url)}
                      className="gap-3"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-medium">{h.title}</span>
                        {h.subtitle && (
                          <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })
        )}
      </CommandList>
    </CommandDialog>
  );
}
