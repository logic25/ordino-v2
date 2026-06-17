import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PROFILE_COLUMNS_NO_GOALS } from "@/lib/profileColumns";

export type Profile = Tables<"profiles">;

// Load company goals (RPC) and merge them onto profile rows. Goals live behind
// a SECURITY DEFINER function so we can preserve the existing UI shape without
// granting direct column SELECT on the sensitive fields.
async function attachGoals<T extends { id: string }>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const { data: goals } = await supabase.rpc("get_company_goals" as any);
  const goalMap = new Map<string, any>();
  (goals || []).forEach((g: any) => goalMap.set(g.id, g));
  return rows.map((r) => {
    const g = goalMap.get(r.id);
    return {
      ...r,
      monthly_goal: g?.monthly_goal ?? null,
      weekly_goal: g?.weekly_goal ?? null,
      accuracy_goal: g?.accuracy_goal ?? null,
    } as T;
  });
}

// Get all profiles in the same company (for assigning PMs, etc.)
export function useCompanyProfiles() {
  return useQuery({
    queryKey: ["company-profiles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!currentProfile?.company_id) {
        return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS_NO_GOALS)
        .eq("company_id", currentProfile.company_id)
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return (await attachGoals((data as any[]) || [])) as Profile[];
    },
  });
}

// Get profiles that can be assigned as PM (pm, manager, admin roles)
export function useAssignableProfiles() {
  return useQuery({
    queryKey: ["assignable-profiles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!currentProfile?.company_id) {
        return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS_NO_GOALS)
        .eq("company_id", currentProfile.company_id)
        .eq("is_active", true)
        .in("role", ["pm", "manager", "admin"])
        .order("first_name");

      if (error) throw error;
      return (await attachGoals((data as any[]) || [])) as Profile[];
    },
  });
}
