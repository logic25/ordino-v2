import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ResearchNote {
  id: string;
  company_id: string;
  project_id: string;
  created_by: string | null;
  query: string;
  response: string | null;
  sources: any[];
  confidence: number | null;
  notes: string | null;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function useResearchNotes(projectId: string | undefined) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const queryKey = ["research_notes", projectId];

  const query = useQuery({
    queryKey,
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_notes" as any)
        .select("*")
        .eq("project_id", projectId!)
        .eq("company_id", companyId!)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ResearchNote[];
    },
  });

  const create = useMutation({
    mutationFn: async (note: {
      query: string;
      response?: string;
      sources?: any[];
      confidence?: number;
      tags?: string[];
    }) => {
      const { data, error } = await supabase
        .from("research_notes" as any)
        .insert({
          project_id: projectId!,
          company_id: companyId!,
          created_by: profile?.id,
          query: note.query,
          response: note.response || null,
          sources: note.sources || [],
          confidence: note.confidence || null,
          tags: note.tags || [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ResearchNote;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; notes?: string; is_pinned?: boolean; tags?: string[]; response?: string }) => {
      const { data, error } = await supabase
        .from("research_notes" as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ResearchNote;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("research_notes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    notes: query.data || [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
    isCreating: create.isPending,
  };
}
