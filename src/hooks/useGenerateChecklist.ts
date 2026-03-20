import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export function useGenerateProjectChecklist() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      filing_type?: string;
      work_type?: string;
      building_class?: string;
      borough?: string;
      project_description?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-project-checklist", {
        body: input,
      });

      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) {
          toast({ title: "Rate limited", description: "Try again shortly.", variant: "destructive" });
        } else if (status === 402) {
          toast({ title: "Credits exhausted", description: "AI credits need to be topped up.", variant: "destructive" });
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["project-checklist", variables.project_id] });
      toast({ title: "Checklist generated", description: `${_data?.items?.length || 0} items created.` });
    },
  });
}
