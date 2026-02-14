import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRoles, type AppRole } from "./useUserRoles";

export type ResourceKey =
  | "dashboard" | "projects" | "properties" | "proposals" | "invoices"
  | "time_logs" | "emails" | "calendar" | "documents" | "clients"
  | "settings" | "users" | "roles" | "reports";

export interface RolePermission {
  id: string;
  company_id: string;
  role: AppRole;
  resource: string;
  enabled: boolean;
  can_list: boolean;
  can_show: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const ALL_RESOURCES: { key: ResourceKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "properties", label: "Properties" },
  { key: "proposals", label: "Proposals" },
  { key: "invoices", label: "Billing" },
  { key: "time_logs", label: "Time Logs" },
  { key: "emails", label: "Emails" },
  { key: "calendar", label: "Calendar" },
  { key: "documents", label: "Documents" },
  { key: "clients", label: "Companies" },
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
  { key: "reports", label: "Reports" },
];

// Fetch all role_permissions for the company
export function useRolePermissions() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["role-permissions", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as RolePermission[];
    },
  });
}

// Mutation to toggle a single permission field
export function useUpdatePermission() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: keyof Pick<RolePermission, "enabled" | "can_list" | "can_show" | "can_create" | "can_update" | "can_delete">;
      value: boolean;
    }) => {
      const { error } = await supabase
        .from("role_permissions")
        .update({ [field]: value } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
    },
  });
}

// Main permissions hook for current user
export function usePermissions() {
  const { data: roles } = useUserRoles();
  const { data: permissions } = useRolePermissions();

  const userRoles = roles?.map((r) => r.role) ?? [];
  const isAdmin = userRoles.includes("admin");

  function getPermission(resource: ResourceKey): RolePermission | undefined {
    if (!permissions) return undefined;
    // Check all user roles and return the most permissive
    for (const role of userRoles) {
      const perm = permissions.find((p) => p.role === role && p.resource === resource);
      if (perm?.enabled) return perm;
    }
    return permissions.find((p) => userRoles.includes(p.role) && p.resource === resource);
  }

  return {
    isAdmin,
    userRoles,
    canAccess: (resource: ResourceKey) => isAdmin || (getPermission(resource)?.enabled ?? false),
    canList: (resource: ResourceKey) => isAdmin || (getPermission(resource)?.can_list ?? false),
    canShow: (resource: ResourceKey) => isAdmin || (getPermission(resource)?.can_show ?? false),
    canCreate: (resource: ResourceKey) => isAdmin || (getPermission(resource)?.can_create ?? false),
    canUpdate: (resource: ResourceKey) => isAdmin || (getPermission(resource)?.can_update ?? false),
    canDelete: (resource: ResourceKey) => isAdmin || (getPermission(resource)?.can_delete ?? false),
    loading: !roles || !permissions,
  };
}
