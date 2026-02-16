import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Info } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useClients } from "@/hooks/useClients";
import type { ProjectWithRelations, ProjectFormInput } from "@/hooks/useProjects";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProjectFormInput) => void;
  project?: ProjectWithRelations | null;
  isLoading: boolean;
}

export function ProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  project,
  isLoading,
}: ProjectDialogProps) {
  const { data: properties = [] } = useProperties();
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: clients = [] } = useClients();

  const [form, setForm] = useState<ProjectFormInput>({
    property_id: "",
    name: "",
    project_type: "",
    floor_number: "",
    status: "open",
    assigned_pm_id: null,
    senior_pm_id: null,
    client_id: null,
    is_external: false,
    notable: false,
    unit_number: "",
    tenant_name: "",
    completion_date: null,
    notes: "",
  });

  useEffect(() => {
    if (project) {
      setForm({
        property_id: project.property_id,
        name: project.name || "",
        project_type: project.project_type || "",
        floor_number: project.floor_number || "",
        status: project.status,
        assigned_pm_id: project.assigned_pm_id,
        senior_pm_id: project.senior_pm_id,
        client_id: project.client_id,
        is_external: project.is_external,
        notable: project.notable,
        unit_number: (project as any).unit_number || "",
        tenant_name: (project as any).tenant_name || "",
        completion_date: project.completion_date,
        notes: project.notes || "",
      });
    } else {
      setForm({
        property_id: "",
        name: "",
        project_type: "",
        floor_number: "",
        status: "open",
        assigned_pm_id: null,
        senior_pm_id: null,
        client_id: null,
        is_external: false,
        notable: false,
        unit_number: "",
        tenant_name: "",
        completion_date: null,
        notes: "",
      });
    }
  }, [project, open]);

  const selectedProperty = properties.find((p) => p.id === form.property_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
          <DialogDescription>
            {project
              ? "Update project details."
              : "Create a new project. Projects are usually created from proposals."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property */}
          <div className="space-y-2">
            <Label htmlFor="property">Property *</Label>
            <Select
              value={form.property_id}
              onValueChange={(val) => setForm((f) => ({ ...f, property_id: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* BBL — from linked property */}
          {selectedProperty && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Borough</Label>
                <Input
                  value={selectedProperty.borough || ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Block</Label>
                <Input
                  value={selectedProperty.block || ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Lot</Label>
                <Input
                  value={selectedProperty.lot || ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={form.name || ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Alteration Type 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project_type">Project Type</Label>
              <Input
                id="project_type"
                value={form.project_type || ""}
                onChange={(e) => setForm((f) => ({ ...f, project_type: e.target.value }))}
                placeholder="e.g., New Building"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, status: val as ProjectFormInput["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="floor_number">Floor Number</Label>
              <Input
                id="floor_number"
                value={form.floor_number || ""}
                onChange={(e) => setForm((f) => ({ ...f, floor_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_number">Unit / Apt Number</Label>
              <Input
                id="unit_number"
                value={form.unit_number || ""}
                onChange={(e) => setForm((f) => ({ ...f, unit_number: e.target.value }))}
                placeholder="e.g., 28A, Suite 500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant_name">Tenant Name</Label>
              <Input
                id="tenant_name"
                value={form.tenant_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, tenant_name: e.target.value }))}
                placeholder="e.g., Acme Corp"
              />
            </div>
          </div>

          {/* People */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Manager</Label>
              <Select
                value={form.assigned_pm_id || "none"}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, assigned_pm_id: val === "none" ? null : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Senior PM</Label>
              <Select
                value={form.senior_pm_id || "none"}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, senior_pm_id: val === "none" ? null : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Senior PM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            <Select
              value={form.client_id || "none"}
              onValueChange={(val) =>
                setForm((f) => ({ ...f, client_id: val === "none" ? null : val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.notable || false}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, notable: checked }))}
              />
              <Label>Notable</Label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes || ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.property_id || isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {project ? "Update" : "Create"} Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
