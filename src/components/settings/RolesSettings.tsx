import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRolePermissions, useUpdatePermission, ALL_RESOURCES, type RolePermission } from "@/hooks/usePermissions";
import type { AppRole } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";

const PERMISSION_FIELDS = [
  { key: "enabled" as const, label: "Enabled" },
  { key: "can_list" as const, label: "List" },
  { key: "can_show" as const, label: "Show" },
  { key: "can_create" as const, label: "Create" },
  { key: "can_update" as const, label: "Update" },
  { key: "can_delete" as const, label: "Delete" },
];

export function RolesSettings() {
  const [selectedRole, setSelectedRole] = useState<AppRole>("production");
  const { data: permissions = [], isLoading } = useRolePermissions();
  const updatePermission = useUpdatePermission();
  const { toast } = useToast();

  const isAdminRole = selectedRole === "admin";

  const rolePerms = permissions.filter((p) => p.role === selectedRole);

  const getPermForResource = (resource: string): RolePermission | undefined =>
    rolePerms.find((p) => p.resource === resource);

  const handleToggle = async (
    perm: RolePermission | undefined,
    field: (typeof PERMISSION_FIELDS)[number]["key"],
    value: boolean
  ) => {
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Role Permissions
            </CardTitle>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="accounting">Accounting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdminRole && (
            <p className="text-xs text-muted-foreground">
              Admin role has full access to everything and cannot be modified.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Resource</TableHead>
                  {PERMISSION_FIELDS.map((f) => (
                    <TableHead key={f.key} className="text-center w-20">
                      {f.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_RESOURCES.map((res) => {
                  const perm = getPermForResource(res.key);
                  return (
                    <TableRow key={res.key}>
                      <TableCell className="font-medium text-sm">{res.label}</TableCell>
                      {PERMISSION_FIELDS.map((field) => (
                        <TableCell key={field.key} className="text-center">
                          <Switch
                            checked={isAdminRole ? true : (perm?.[field.key] ?? false)}
                            disabled={isAdminRole || updatePermission.isPending}
                            onCheckedChange={(v) => handleToggle(perm, field.key, v)}
                            className="mx-auto"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
