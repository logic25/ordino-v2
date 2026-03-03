import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useReportSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["report-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("report_settings")
        .select("*")
        .eq("company_id", companyId)
        .eq("report_type", "open_services")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const updateSettings = useMutation({
    mutationFn: async (values: { frequency: string; day_of_week?: string }) => {
      if (!companyId) throw new Error("No company");
      const { data, error } = await supabase
        .from("report_settings")
        .upsert(
          {
            company_id: companyId,
            report_type: "open_services",
            frequency: values.frequency,
            day_of_week: values.day_of_week || "monday",
          },
          { onConflict: "company_id,report_type" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-settings"] });
      toast.success("Report settings saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendNow = useMutation({
    mutationFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-open-services-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send report");
      return json;
    },
    onSuccess: (data) => {
      toast.success(`Report sent to ${data.emails_sent} recipient(s)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { settings, isLoading, updateSettings, sendNow };
}
