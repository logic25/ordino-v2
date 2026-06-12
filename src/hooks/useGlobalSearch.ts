import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GlobalSearchKind = "lead" | "proposal" | "client" | "project" | "property";

export interface GlobalSearchHit {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useGlobalSearch(query: string) {
  const debounced = useDebounced(query, 200).trim();
  return useQuery({
    queryKey: ["global-search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchHit[]> => {
      const { data, error } = await supabase.rpc("global_search", {
        _q: debounced,
        _limit: 8,
      });
      if (error) throw error;
      return (data || []) as GlobalSearchHit[];
    },
  });
}
