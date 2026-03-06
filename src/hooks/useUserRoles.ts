import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// AppRole is now a string (dynamic roles from custom_roles table)
export type AppRole = string;

export interface UserRole {
  id: string;
  user_id: string;
  role: string;
  company_id: string;
  created_at: string;
}

export interface CustomRole {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserRoles() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["user-roles", session?.user?.id],
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", session!.user.id);
      if (error) throw error;
      return (data || []) as unknown as UserRole[];
    },
  });
}

export function useCustomRoles() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["custom-roles", session?.user?.id],
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CustomRole[];
    },
  });
}

export function useHasRole(role: string) {
  const { data: roles } = useUserRoles();
  return roles?.some((r) => r.role === role) ?? false;
}

export function useIsAdmin() {
  return useHasRole("admin");
}

export function useIsAccounting() {
  const isAdmin = useHasRole("admin");
  const isAccounting = useHasRole("accounting");
  return isAdmin || isAccounting;
}

export function useIsProduction() {
  const isAdmin = useHasRole("admin");
  const isProduction = useHasRole("production");
  return isAdmin || isProduction;
}

export function useCanAccessBilling() {
  const isAdmin = useHasRole("admin");
  const isAccounting = useHasRole("accounting");
  return isAdmin || isAccounting;
}

export function useCanAccessProjects() {
  const isAdmin = useHasRole("admin");
  const isProduction = useHasRole("production");
  return isAdmin || isProduction;
}
