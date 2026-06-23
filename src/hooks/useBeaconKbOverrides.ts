import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface BeaconKbOverride {
  id: string;
  company_id: string;
  source_file: string;
  display_folder: string;
  hidden_from_original: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useBeaconKbOverrides() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["beacon-kb-overrides", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<BeaconKbOverride[]> => {
      const { data, error } = await (supabase as any)
        .from("beacon_kb_folder_overrides")
        .select("*")
        .eq("company_id", profile!.company_id);
      if (error) throw error;
      return (data || []) as BeaconKbOverride[];
    },
  });
}

export function useUpsertBeaconKbOverride() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      source_file: string;
      display_folder: string;
      hidden_from_original?: boolean;
      notes?: string | null;
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("beacon_kb_folder_overrides")
        .upsert(
          {
            company_id: profile.company_id,
            source_file: params.source_file,
            display_folder: params.display_folder,
            hidden_from_original: params.hidden_from_original ?? true,
            notes: params.notes ?? null,
            created_by: user?.id ?? null,
          },
          { onConflict: "company_id,source_file" }
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["beacon-kb-overrides"] });
      toast({ title: "Moved", description: `Now shown under "${vars.display_folder}"` });
    },
    onError: (err: any) => {
      toast({ title: "Move failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useClearBeaconKbOverride() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (source_file: string) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await (supabase as any)
        .from("beacon_kb_folder_overrides")
        .delete()
        .eq("company_id", profile.company_id)
        .eq("source_file", source_file);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beacon-kb-overrides"] });
      toast({ title: "Reset", description: "File returned to its original Beacon folder" });
    },
  });
}
