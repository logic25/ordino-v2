import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

// Get all profiles in the same company (for assigning PMs, etc.)
export function useCompanyProfiles() {
  return useQuery({
    queryKey: ["company-profiles"],
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
        .select("*")
        .eq("company_id", currentProfile.company_id)
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data as Profile[];
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
        .select("*")
        .eq("company_id", currentProfile.company_id)
        .eq("is_active", true)
        .in("role", ["pm", "manager", "admin"])
        .order("first_name");

      if (error) throw error;
      return data as Profile[];
    },
  });
}
