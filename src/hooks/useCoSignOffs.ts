import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CoSignOff {
  id: string;
  company_id: string;
  property_id: string;
  name: string;
  status: string;
  tco_required: boolean;
  sign_off_date: string | null;
  job_num: string | null;
  expiration_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CoSignOffInput {
  name: string;
  status?: string;
  tco_required?: boolean;
  sign_off_date?: string | null;
  job_num?: string | null;
  expiration_date?: string | null;
  sort_order?: number;
}

// Default sign-offs used to seed a new CO setup
export const DEFAULT_CO_SIGN_OFFS: CoSignOffInput[] = [
  { name: "Final Construction", status: "Pending", tco_required: false, sort_order: 0 },
  { name: "Final Plumbing", status: "Pending", tco_required: false, sort_order: 1 },
  { name: "Final Elevator", status: "Pending", tco_required: true, sort_order: 2 },
  { name: "Temp Elevator", status: "Pending", tco_required: true, sort_order: 3 },
  { name: "Final Electrical", status: "Pending", tco_required: true, sort_order: 4 },
  { name: "Sprinkler", status: "Pending", tco_required: true, sort_order: 5 },
  { name: "Standpipe", status: "Pending", tco_required: true, sort_order: 6 },
  { name: "Fire Alarm", status: "Pending", tco_required: true, sort_order: 7 },
  { name: "Smoke Purge", status: "Pending", tco_required: true, sort_order: 8 },
  { name: "Fire Protection Plan", status: "Pending", tco_required: true, sort_order: 9 },
];

export function useCoSignOffs(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["co-sign-offs", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("co_sign_offs")
        .select("*")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as CoSignOff[];
    },
    enabled: !!propertyId,
  });
}

export function useSeedCoSignOffs() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, signOffs }: { propertyId: string; signOffs: CoSignOffInput[] }) => {
      if (!profile?.company_id) throw new Error("No company");
      const rows = signOffs.map((so, i) => ({
        company_id: profile.company_id,
        property_id: propertyId,
        name: so.name,
        status: so.status || "Pending",
        tco_required: so.tco_required ?? false,
        sign_off_date: so.sign_off_date || null,
        job_num: so.job_num || null,
        expiration_date: so.expiration_date || null,
        sort_order: so.sort_order ?? i,
      }));
      const { error } = await supabase.from("co_sign_offs").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["co-sign-offs", vars.propertyId] });
    },
  });
}

export function useUpdateCoSignOff() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CoSignOff> & { id: string }) => {
      const { error } = await supabase
        .from("co_sign_offs")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["co-sign-offs"] });
    },
  });
}

export function useAddCoSignOff() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, ...input }: CoSignOffInput & { propertyId: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("co_sign_offs").insert({
        company_id: profile.company_id,
        property_id: propertyId,
        name: input.name,
        status: input.status || "Pending",
        tco_required: input.tco_required ?? false,
        sign_off_date: input.sign_off_date || null,
        job_num: input.job_num || null,
        expiration_date: input.expiration_date || null,
        sort_order: input.sort_order ?? 99,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["co-sign-offs", vars.propertyId] });
    },
  });
}

export function useDeleteCoSignOff() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("co_sign_offs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["co-sign-offs"] });
    },
  });
}
