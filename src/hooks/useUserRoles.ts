import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "production" | "accounting";

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  company_id: string;
  created_at: string;
}

export function useUserRoles() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["user-roles", session?.user?.id],
    enabled: !!session?.user?.id,
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

export function useHasRole(role: AppRole) {
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
