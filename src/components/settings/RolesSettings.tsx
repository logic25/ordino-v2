import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Shield, Lock, Eye, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRolePermissions, useUpdatePermission, ALL_RESOURCES, type RolePermission } from "@/hooks/usePermissions";
import type { AppRole } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";

const ROLE_CONFIG: Record<AppRole, { label: string; description: string; color: string; icon: typeof Shield }> = {
  admin: {
    label: "Admin",
    description: "Full access to all resources. Cannot be modified.",
    color: "bg-primary/10 text-primary border-primary/30",
    icon: ShieldCheck,
  },
  production: {
    label: "Production",
    description: "Project managers, filing reps, and field staff. Controls access to projects, properties, and proposals.",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    icon: Shield,
  },
  accounting: {
    label: "Accounting",
    description: "Billing team. Controls access to invoices, collections, and financial data.",
    color: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    icon: Shield,
  },
};

const PERMISSION_LABELS: Record<string, { label: string; icon: typeof Eye }> = {
  enabled: { label: "Access", icon: CheckCircle2 },
  can_list: { label: "List", icon: Eye },
  can_show: { label: "View", icon: Eye },
  can_create: { label: "Create", icon: Plus },
  can_update: { label: "Edit", icon: Pencil },
  can_delete: { label: "Delete", icon: Trash2 },
};

const PERMISSION_FIELDS = ["enabled", "can_list", "can_show", "can_create", "can_update", "can_delete"] as const;

type PermField = typeof PERMISSION_FIELDS[number];

export function RolesSettings() {
  const [selectedRole, setSelectedRole] = useState<AppRole>("production");
  const { data: permissions = [], isLoading } = useRolePermissions();
  const updatePermission = useUpdatePermission();
  const { toast } = useToast();

  const isAdminRole = selectedRole === "admin";
  const rolePerms = permissions.filter((p) => p.role === selectedRole);
  const getPermForResource = (resource: string): RolePermission | undefined =>
    rolePerms.find((p) => p.resource === resource);

  const handleToggle = async (perm: RolePermission | undefined, field: PermField, value: boolean) => {
    if (!perm || isAdminRole) return;
    try {
      await updatePermission.mutateAsync({ id: perm.id, field, value });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roles: AppRole[] = ["admin", "production", "accounting"];

  return (
    <div className="space-y-6">
      {/* Role Selector Cards */}
      <div className="grid grid-cols-3 gap-3">
        {roles.map((role) => {
          const config = ROLE_CONFIG[role];
          const Icon = config.icon;
          const isActive = selectedRole === role;
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "relative rounded-xl border-2 p-4 text-left transition-all",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-semibold text-sm">{config.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                {config.description}
              </p>
              {role === "admin" && (
                <Badge variant="outline" className="absolute top-3 right-3 text-[9px] px-1.5 py-0 gap-1">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Permissions Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {ROLE_CONFIG[selectedRole].label} Permissions
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isAdminRole
                  ? "Admin has full access to everything. These permissions cannot be changed."
                  : "Toggle permissions for each resource below."
                }
              </CardDescription>
            </div>
            {!isAdminRole && (
              <Badge variant="secondary" className="text-[10px]">
                {rolePerms.filter((p) => p.enabled).length} / {ALL_RESOURCES.length} enabled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {ALL_RESOURCES.map((res) => {
            const perm = getPermForResource(res.key);
            const isEnabled = isAdminRole || (perm?.enabled ?? false);
            
            return (
              <div
                key={res.key}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  isEnabled ? "bg-card" : "bg-muted/30 opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{res.label}</span>
                    {isAdminRole && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <Switch
                    checked={isEnabled}
                    disabled={isAdminRole || updatePermission.isPending}
                    onCheckedChange={(v) => handleToggle(perm, "enabled", v)}
                  />
                </div>
                {isEnabled && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {PERMISSION_FIELDS.filter((f) => f !== "enabled").map((field) => {
                      const info = PERMISSION_LABELS[field];
                      const checked = isAdminRole || (perm?.[field] ?? false);
                      return (
                        <label
                          key={field}
                          className={cn(
                            "flex items-center gap-1.5 text-xs cursor-pointer select-none rounded-md px-2 py-1 border transition-colors",
                            checked
                              ? "bg-primary/5 border-primary/20 text-foreground"
                              : "bg-muted/30 border-transparent text-muted-foreground",
                            isAdminRole && "cursor-default"
                          )}
                        >
                          <Switch
                            checked={checked}
                            disabled={isAdminRole || updatePermission.isPending}
                            onCheckedChange={(v) => handleToggle(perm, field, v)}
                            className="scale-75 origin-left"
                          />
                          {info.label}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
