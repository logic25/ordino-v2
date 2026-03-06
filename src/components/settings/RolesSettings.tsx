import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Shield, Lock, Eye, Plus, Pencil, Trash2, CheckCircle2, ShieldAlert, ShieldPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRolePermissions, useUpdatePermission, ALL_RESOURCES, type RolePermission } from "@/hooks/usePermissions";
import { useCustomRoles, type CustomRole } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const ICON_OPTIONS = [
  { value: "Shield", label: "Shield", Icon: Shield },
  { value: "ShieldCheck", label: "Shield Check", Icon: ShieldCheck },
  { value: "ShieldAlert", label: "Shield Alert", Icon: ShieldAlert },
  { value: "ShieldPlus", label: "Shield Plus", Icon: ShieldPlus },
  { value: "Eye", label: "Eye", Icon: Eye },
];

const COLOR_OPTIONS = [
  { value: "primary", label: "Primary", classes: "bg-primary/10 text-primary border-primary/30" },
  { value: "blue", label: "Blue", classes: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  { value: "amber", label: "Amber", classes: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { value: "green", label: "Green", classes: "bg-green-500/10 text-green-700 border-green-500/30" },
  { value: "red", label: "Red", classes: "bg-red-500/10 text-red-700 border-red-500/30" },
  { value: "purple", label: "Purple", classes: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
  { value: "teal", label: "Teal", classes: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
  { value: "orange", label: "Orange", classes: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
];

function getColorClasses(color: string) {
  return COLOR_OPTIONS.find((c) => c.value === color)?.classes ?? "bg-muted text-muted-foreground border-border";
}

function getIcon(iconName: string) {
  return ICON_OPTIONS.find((i) => i.value === iconName)?.Icon ?? Shield;
}

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
  const [selectedRole, setSelectedRole] = useState<string>("production");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<CustomRole | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: permissions = [], isLoading: permLoading } = useRolePermissions();
  const { data: customRoles = [], isLoading: rolesLoading } = useCustomRoles();
  const updatePermission = useUpdatePermission();
  const { toast } = useToast();
  const { session } = useAuth();
  const qc = useQueryClient();

  const isLoading = permLoading || rolesLoading;
  const selectedCustomRole = customRoles.find((r) => r.name === selectedRole);
  const isAdminRole = selectedRole === "admin";
  const isSystemRole = selectedCustomRole?.is_system ?? false;
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

  const handleCreateOrUpdateRole = async (name: string, description: string, color: string, icon: string) => {
    setSaving(true);
    try {
      const profile = await supabase.from("profiles").select("company_id").eq("user_id", session!.user.id).single();
      if (profile.error) throw profile.error;
      const companyId = profile.data.company_id;

      if (editingRole) {
        const { error } = await supabase
          .from("custom_roles")
          .update({ name, description, color, icon, updated_at: new Date().toISOString() } as any)
          .eq("id", editingRole.id);
        if (error) throw error;
        
        // If name changed, update role_permissions and user_roles
        if (editingRole.name !== name) {
          await supabase.from("role_permissions").update({ role: name } as any).eq("role", editingRole.name).eq("company_id", companyId);
          await supabase.from("user_roles").update({ role: name } as any).eq("role", editingRole.name).eq("company_id", companyId);
        }
        toast({ title: "Role updated" });
      } else {
        const { error } = await supabase
          .from("custom_roles")
          .insert({ company_id: companyId, name, description, color, icon } as any);
        if (error) throw error;

        // Seed permissions for the new role
        await supabase.rpc("seed_permissions_for_role", { target_company_id: companyId, role_name: name });
        toast({ title: "Role created", description: `"${name}" role has been created with all permissions disabled. Configure access below.` });
        setSelectedRole(name);
      }

      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      setShowCreateDialog(false);
      setEditingRole(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteConfirmRole) return;
    setSaving(true);
    try {
      const profile = await supabase.from("profiles").select("company_id").eq("user_id", session!.user.id).single();
      if (profile.error) throw profile.error;

      // Delete permissions for this role
      await supabase.from("role_permissions").delete().eq("role", deleteConfirmRole.name).eq("company_id", profile.data.company_id);
      // Remove role assignments
      await supabase.from("user_roles").delete().eq("role", deleteConfirmRole.name).eq("company_id", profile.data.company_id);
      // Delete the role
      await supabase.from("custom_roles").delete().eq("id", deleteConfirmRole.id);

      toast({ title: "Role deleted" });
      if (selectedRole === deleteConfirmRole.name) setSelectedRole("admin");
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["user-roles"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setDeleteConfirmRole(null);
      setDeleteConfirmText("");
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
    <div className="space-y-6">
      {/* Role Selector Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Roles</h3>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditingRole(null); setShowCreateDialog(true); }}>
          <Plus className="h-3.5 w-3.5" /> New Role
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {customRoles.map((role) => {
          const Icon = getIcon(role.icon);
          const isActive = selectedRole === role.name;
          const colorClasses = getColorClasses(role.color);
          return (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.name)}
              className={cn(
                "relative rounded-xl border-2 p-4 text-left transition-all",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClasses)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-semibold text-sm capitalize">{role.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                {role.description || "No description"}
              </p>
              {role.name === "admin" && (
                <Badge variant="outline" className="absolute top-3 right-3 text-[9px] px-1.5 py-0 gap-1">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </Badge>
              )}
              {!role.is_system && isActive && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingRole(role); setShowCreateDialog(true); }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmRole(role); }}
                    className="p-1 rounded hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
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
              <CardTitle className="text-base capitalize">
                {selectedRole} Permissions
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

      {/* Create/Edit Role Dialog */}
      <RoleFormDialog
        open={showCreateDialog}
        onOpenChange={(v) => { setShowCreateDialog(v); if (!v) setEditingRole(null); }}
        role={editingRole}
        saving={saving}
        onSave={handleCreateOrUpdateRole}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmRole} onOpenChange={(v) => { if (!v) { setDeleteConfirmRole(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role: {deleteConfirmRole?.name}</DialogTitle>
            <DialogDescription>
              This will remove the role, all its permissions, and unassign it from all users. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm:</p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirmRole(null); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE" || saving}
              onClick={handleDeleteRole}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleFormDialog({
  open,
  onOpenChange,
  role,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: CustomRole | null;
  saving: boolean;
  onSave: (name: string, description: string, color: string, icon: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [icon, setIcon] = useState("Shield");

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setColor(role?.color ?? "blue");
      setIcon(role?.icon ?? "Shield");
    }
    onOpenChange(v);
  };

  const isEdit = !!role;
  const SelectedIcon = getIcon(icon);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Create New Role"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update role details. Permissions are managed separately." : "Add a custom role to your organization."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="e.g. field_staff"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Lowercase, underscores only. This is the internal identifier.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this role do?"
              className="mt-1"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Color</label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", c.classes)} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Icon</label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      <div className="flex items-center gap-2">
                        <i.Icon className="h-3.5 w-3.5" />
                        {i.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-3">
            <p className="text-[11px] text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", getColorClasses(color))}>
                <SelectedIcon className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm">{name || "role_name"}</span>
                <p className="text-[11px] text-muted-foreground">{description || "No description"}</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || saving}
            onClick={() => onSave(name, description, color, icon)}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
