import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface DiscoveredRfp {
  id: string;
  company_id: string;
  source_id: string | null;
  title: string;
  rfp_number: string | null;
  issuing_agency: string | null;
  due_date: string | null;
  original_url: string | null;
  pdf_url: string | null;
  discovered_at: string;
  relevance_score: number | null;
  relevance_reason: string | null;
  service_tags: string[];
  estimated_value: number | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  rfp_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfpSource {
  id: string;
  company_id: string;
  source_name: string;
  source_url: string;
  source_type: string;
  check_frequency: string;
  last_checked_at: string | null;
  active: boolean;
  created_at: string;
}

export interface RfpMonitoringRule {
  id: string;
  company_id: string;
  keyword_include: string[];
  keyword_exclude: string[];
  agencies_include: string[];
  min_relevance_score: number;
  notify_email: boolean;
  email_recipients: string[];
  active: boolean;
  created_at: string;
}

export function useDiscoveredRfps(statusFilter?: string) {
  return useQuery({
    queryKey: ["discovered-rfps", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("discovered_rfps")
        .select("*")
        .order("discovered_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DiscoveredRfp[];
    },
  });
}

export function useUpdateDiscoveredRfp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<DiscoveredRfp>) => {
      const { error } = await supabase
        .from("discovered_rfps")
        .update(fields as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovered-rfps"] }),
  });
}

export function useRfpSources() {
  return useQuery({
    queryKey: ["rfp-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfp_sources")
        .select("*")
        .order("source_name");
      if (error) throw error;
      return (data || []) as RfpSource[];
    },
  });
}

export function useUpdateRfpSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<RfpSource>) => {
      const { error } = await supabase
        .from("rfp_sources")
        .update(fields as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfp-sources"] }),
  });
}

export function useRfpMonitoringRules() {
  return useQuery({
    queryKey: ["rfp-monitoring-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfp_monitoring_rules")
        .select("*")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RfpMonitoringRule | null;
    },
  });
}

export function useUpsertMonitoringRules() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (fields: Partial<RfpMonitoringRule>) => {
      if (!profile?.company_id) throw new Error("No company");

      // Check if exists
      const { data: existing } = await supabase
        .from("rfp_monitoring_rules")
        .select("id")
        .eq("company_id", profile.company_id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("rfp_monitoring_rules")
          .update(fields as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rfp_monitoring_rules")
          .insert({ ...fields, company_id: profile.company_id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfp-monitoring-rules"] }),
  });
}

export function useTriggerRfpScan() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase.functions.invoke("monitor-rfps", {
        body: { company_id: profile.company_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { new_count: number; total_scanned: number; sources_checked: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["discovered-rfps"] });
      qc.invalidateQueries({ queryKey: ["rfp-sources"] });
      toast({
        title: "Scan complete",
        description: `Found ${data.new_count} new RFPs from ${data.sources_checked} sources (${data.total_scanned} scanned).`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });
}
