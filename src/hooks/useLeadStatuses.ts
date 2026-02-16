import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LeadStatus {
  id: string;
  company_id: string;
  label: string;
  value: string;
  variant: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
}

const DEFAULT_STATUSES: Omit<LeadStatus, "id" | "company_id" | "created_at">[] = [
  { label: "New", value: "new", variant: "default", sort_order: 0, is_system: true },
  { label: "Contacted", value: "contacted", variant: "outline", sort_order: 1, is_system: true },
  { label: "Qualified", value: "qualified", variant: "default", sort_order: 2, is_system: true },
  { label: "Proposal Sent", value: "proposal_sent", variant: "secondary", sort_order: 3, is_system: true },
  { label: "Negotiating", value: "negotiating", variant: "outline", sort_order: 4, is_system: true },
  { label: "Won", value: "won", variant: "default", sort_order: 5, is_system: true },
  { label: "Lost", value: "lost", variant: "destructive", sort_order: 6, is_system: true },
  { label: "On Hold", value: "on_hold", variant: "secondary", sort_order: 7, is_system: true },
  { label: "Referral", value: "referral", variant: "outline", sort_order: 8, is_system: true },
];

export function useLeadStatuses() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["lead-statuses"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("*")
        .order("sort_order")
        .order("label");
      if (error) throw error;
      const statuses = (data || []) as unknown as LeadStatus[];
      if (statuses.length === 0) {
        // Seed defaults on first access
        const seeds = DEFAULT_STATUSES.map((s) => ({
          ...s,
          company_id: profile!.company_id!,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from("lead_statuses")
          .insert(seeds as any)
          .select();
        if (seedErr) throw seedErr;
        return (seeded || []) as unknown as LeadStatus[];
      }
      return statuses;
    },
  });
}

export function useCreateLeadStatus() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { label: string; value: string; variant?: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("lead_statuses").insert({
        company_id: profile.company_id,
        label: input.label,
        value: input.value,
        variant: input.variant || "default",
        sort_order: 99,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-statuses"] }),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; label?: string; variant?: string; sort_order?: number }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("lead_statuses").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-statuses"] }),
  });
}

export function useDeleteLeadStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-statuses"] }),
  });
}
