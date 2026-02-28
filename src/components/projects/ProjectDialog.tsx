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
import { Separator } from "@/components/ui/separator";
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
    building_owner_id: null,
    building_owner_name: "",
    is_external: false,
    notable: false,
    unit_number: "",
    tenant_name: "",
    client_reference_number: "",
    completion_date: null,
    notes: "",
    expected_construction_start: null,
    estimated_construction_completion: null,
    actual_construction_start: null,
    actual_construction_completion: null,
    project_complexity_tier: null,
    gc_company_name: "",
    gc_contact_name: "",
    gc_phone: "",
    gc_email: "",
    architect_company_name: "",
    architect_contact_name: "",
    architect_phone: "",
    architect_email: "",
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
        building_owner_id: project.building_owner_id,
        building_owner_name: (project as any).building_owner_name || "",
        is_external: project.is_external,
        notable: project.notable,
        unit_number: (project as any).unit_number || "",
        tenant_name: (project as any).tenant_name || "",
        client_reference_number: (project as any).client_reference_number || "",
        completion_date: project.completion_date,
        notes: project.notes || "",
        expected_construction_start: (project as any).expected_construction_start || null,
        estimated_construction_completion: (project as any).estimated_construction_completion || null,
        actual_construction_start: (project as any).actual_construction_start || null,
        actual_construction_completion: (project as any).actual_construction_completion || null,
        project_complexity_tier: (project as any).project_complexity_tier || null,
        gc_company_name: (project as any).gc_company_name || "",
        gc_contact_name: (project as any).gc_contact_name || "",
        gc_phone: (project as any).gc_phone || "",
        gc_email: (project as any).gc_email || "",
        architect_company_name: (project as any).architect_company_name || "",
        architect_contact_name: (project as any).architect_contact_name || "",
        architect_phone: (project as any).architect_phone || "",
        architect_email: (project as any).architect_email || "",
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
        building_owner_id: null,
        building_owner_name: "",
        is_external: false,
        notable: false,
        unit_number: "",
        tenant_name: "",
        client_reference_number: "",
        completion_date: null,
        notes: "",
        expected_construction_start: null,
        estimated_construction_completion: null,
        actual_construction_start: null,
        actual_construction_completion: null,
        project_complexity_tier: null,
        gc_company_name: "",
        gc_contact_name: "",
        gc_phone: "",
        gc_email: "",
        architect_company_name: "",
        architect_contact_name: "",
        architect_phone: "",
        architect_email: "",
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
            <div className="space-y-2">
              <Label htmlFor="client_reference_number">Client Reference #</Label>
              <Input
                id="client_reference_number"
                value={form.client_reference_number || ""}
                onChange={(e) => setForm((f) => ({ ...f, client_reference_number: e.target.value }))}
                placeholder="e.g., NY Tent #611490"
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

          {/* Building Owner */}
          <div className="space-y-2">
            <Label>Building Owner</Label>
            <Select
              value={form.building_owner_id || "none"}
              onValueChange={(val) =>
                setForm((f) => ({ ...f, building_owner_id: val === "none" ? null : val, building_owner_name: val === "none" ? "" : (clients.find(c => c.id === val)?.name || "") }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select building owner" />
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
            <Input
              value={form.building_owner_name || ""}
              onChange={(e) => setForm((f) => ({ ...f, building_owner_name: e.target.value }))}
              placeholder="Or type owner name if not in list"
              className="mt-1"
            />
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

          {/* Construction Timeline */}
          <Separator />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Construction Timeline</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expected Start</Label>
              <Input
                type="date"
                value={form.expected_construction_start || ""}
                onChange={(e) => setForm((f) => ({ ...f, expected_construction_start: e.target.value || null }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Completion</Label>
              <Input
                type="date"
                value={form.estimated_construction_completion || ""}
                onChange={(e) => setForm((f) => ({ ...f, estimated_construction_completion: e.target.value || null }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Actual Start</Label>
              <Input
                type="date"
                value={form.actual_construction_start || ""}
                onChange={(e) => setForm((f) => ({ ...f, actual_construction_start: e.target.value || null }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual Completion</Label>
              <Input
                type="date"
                value={form.actual_construction_completion || ""}
                onChange={(e) => setForm((f) => ({ ...f, actual_construction_completion: e.target.value || null }))}
              />
            </div>
          </div>

          {/* Complexity Tier */}
          <div className="space-y-2">
            <Label>Complexity Tier</Label>
            <Select
              value={form.project_complexity_tier || "__none__"}
              onValueChange={(val) => setForm((f) => ({ ...f, project_complexity_tier: val === "__none__" ? null : val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="tier_1">Tier 1 — Cosmetic / &lt;2k SF / Residential</SelectItem>
                <SelectItem value="tier_2">Tier 2 — Mechanical / 2-5k SF / Mixed-Use</SelectItem>
                <SelectItem value="tier_3">Tier 3 — Structural / 5-15k SF / Commercial</SelectItem>
                <SelectItem value="tier_4">Tier 4 — New Building / &gt;15k SF / Complex</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* General Contractor */}
          <Separator />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">General Contractor</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={form.gc_company_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, gc_company_name: e.target.value }))}
                placeholder="GC company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={form.gc_contact_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, gc_contact_name: e.target.value }))}
                placeholder="Contact person"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.gc_phone || ""}
                onChange={(e) => setForm((f) => ({ ...f, gc_phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.gc_email || ""}
                onChange={(e) => setForm((f) => ({ ...f, gc_email: e.target.value }))}
                placeholder="gc@example.com"
              />
            </div>
          </div>

          {/* Architect / Engineer */}
          <Separator />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Architect / Engineer</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Firm</Label>
              <Input
                value={form.architect_company_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, architect_company_name: e.target.value }))}
                placeholder="Architecture firm"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={form.architect_contact_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, architect_contact_name: e.target.value }))}
                placeholder="Contact person"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.architect_phone || ""}
                onChange={(e) => setForm((f) => ({ ...f, architect_phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.architect_email || ""}
                onChange={(e) => setForm((f) => ({ ...f, architect_email: e.target.value }))}
                placeholder="architect@example.com"
              />
            </div>
          </div>

          {/* Notes */}
          <Separator />
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
