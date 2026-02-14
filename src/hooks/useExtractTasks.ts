import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractedTask {
  id: string | null;
  title: string;
  task_type: string;
  priority: number;
  due_in_days: number;
  due_date: string;
  ai_recommended_action: string;
}

interface ExtractTasksParams {
  note_text: string;
  invoice_id: string;
  client_name?: string;
  invoice_number?: string;
  days_overdue?: number;
  amount_due?: number;
}

export function useExtractTasks() {
  return useMutation({
    mutationFn: async (params: ExtractTasksParams): Promise<ExtractedTask[]> => {
      const { data, error } = await supabase.functions.invoke("extract-tasks", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.tasks || [];
    },
  });
}
