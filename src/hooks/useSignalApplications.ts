import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SignalApplication {
  id: string;
  property_id: string;
  company_id: string;
  job_number: string;
  application_type: string;
  filing_status: string | null;
  applicant_name: string | null;
  filed_date: string | null;
  description: string | null;
  raw_data: any;
  created_at: string;
}

export function useSignalApplications(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["signal-applications", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("signal_applications")
        .select("*")
        .eq("property_id", propertyId)
        .order("filed_date", { ascending: false });

      if (error) throw error;
      return data as SignalApplication[];
    },
    enabled: !!propertyId,
  });
}
