import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./useAuth";

export type JurisdictionStatus = "researching" | "candidate" | "validating" | "live" | "rejected";

export interface Jurisdiction {
  id: string;
  company_id: string;
  name: string;
  state: string | null;
  status: JurisdictionStatus;
  tier: number | null;
  portal_url: string | null;
  portal_platform: string | null;
  online_filing: boolean | null;
  plans_upload_online: boolean | null;
  online_payments: boolean | null;
  inspection_scheduling_online: boolean | null;
  license_required: boolean | null;
  owner_auth_sufficient: boolean | null;
  annual_permits: number | null;
  permit_trend: "increasing" | "flat" | "decreasing" | null;
  open_data_url: string | null;
  open_data_platform: string | null;
  kb_status: "none" | "building" | "loaded";
  eval_pass_rate: number | null;
  eval_last_run_at: string | null;
  salesperson_id: string | null;
  revenue_goal: number | null;
  revenue_actual: number | null;
  notes: string | null;
  research: Record<string, any>;
  created_at: string;
  updated_at: string;
  // joined
  salesperson?: { id: string; first_name: string | null; last_name: string | null } | null;
}

const SELECT =
  "*, salesperson:profiles!jurisdictions_salesperson_id_fkey(id, first_name, last_name)";

export function useJurisdictions() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["jurisdictions"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jurisdictions")
        .select(SELECT)
        .order("status", { ascending: true })
        .order("tier", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Jurisdiction[];
    },
  });
}

export function useCreateJurisdiction() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Jurisdiction> & { name: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { salesperson, id, company_id, created_at, updated_at, ...rest } = input as any;
      const { data, error } = await supabase
        .from("jurisdictions")
        .insert({ ...rest, company_id: profile.company_id, created_by: profile.id } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jurisdictions"] }),
    onError: (e: any) =>
      toast({ title: "Could not add market", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });
}

export function useUpdateJurisdiction() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Jurisdiction> & { id: string }) => {
      const { id, salesperson, company_id, created_at, updated_at, ...updates } = input as any;
      const { error } = await supabase.from("jurisdictions").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jurisdictions"] }),
    onError: (e: any) =>
      toast({ title: "Could not update market", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });
}

export function useDeleteJurisdiction() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jurisdictions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jurisdictions"] }),
    onError: (e: any) =>
      toast({ title: "Could not delete market", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });
}
