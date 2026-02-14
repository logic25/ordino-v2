import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, User, Download, GitBranch } from "lucide-react";
import { useRfpContent, useCreateRfpContent, useUpdateRfpContent, useDeleteRfpContent } from "@/hooks/useRfpContent";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";

interface StaffBioContent {
  name: string;
  title: string;
  years_experience: number | null;
  years_with_company: number | null;
  bio: string;
  hourly_rate: number | null;
  percentage_on_project: number | null;
  certifications: { type: string; number: string; expires: string }[];
  education: { school: string; degree: string }[];
  reports_to?: string;
  include_in_org_chart?: boolean;
}

const emptyBio: StaffBioContent = {
  name: "",
  title: "",
  years_experience: null,
  years_with_company: null,
  bio: "",
  hourly_rate: null,
  percentage_on_project: null,
  certifications: [],
  education: [],
  reports_to: "",
  include_in_org_chart: true,
};

// ── Org Chart Visual ──
function OrgChart({ items }: { items: { id: string; content: StaffBioContent }[] }) {
  const eligible = items.filter((i) => i.content.include_in_org_chart !== false);
  
  const byName = new Map(eligible.map((i) => [i.content.name, i]));
  const children = new Map<string, typeof eligible>();
  const roots: typeof eligible = [];

  eligible.forEach((item) => {
    const parent = item.content.reports_to;
    if (parent && byName.has(parent)) {
      const list = children.get(parent) || [];
      list.push(item);
      children.set(parent, list);
    } else {
      roots.push(item);
    }
  });

  if (eligible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No staff members included in org chart. Toggle "Include in Org Chart" on staff bios.
      </p>
    );
  }

  const renderNode = (item: typeof eligible[0], depth: number) => {
    const kids = children.get(item.content.name) || [];
    const isRoot = depth === 0;
    const initials = item.content.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div key={item.id} className="flex flex-col items-center">
        <div
          className={`relative rounded-xl px-5 py-3.5 text-center min-w-[170px] transition-all duration-200 ${
            isRoot
              ? "bg-primary text-primary-foreground shadow-lg border-0"
              : depth === 1
              ? "bg-accent/10 border-2 border-accent/40 shadow-md hover:shadow-amber hover:border-accent"
              : "bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          {/* Accent dot indicator - GLE style */}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
            isRoot ? "bg-accent shadow-amber" : depth === 1 ? "bg-success" : "bg-info"
          }`} />
          
          {/* Avatar circle */}
          <div
            className={`mx-auto mb-2 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ${
              isRoot
                ? "bg-accent text-accent-foreground ring-accent/50"
                : depth === 1
                ? "bg-accent/20 text-accent ring-accent/30"
                : "bg-info/15 text-info ring-info/30"
            }`}
          >
            {initials}
          </div>
          <p className={`font-semibold text-sm ${isRoot ? "" : "text-foreground"}`}>
            {item.content.name}
          </p>
          <p className={`text-xs mt-0.5 ${isRoot ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {item.content.title}
          </p>
          {item.content.years_experience && (
            <Badge
              variant="outline"
              className={`text-[10px] mt-1.5 px-1.5 py-0 h-4 ${
                isRoot ? "border-primary-foreground/30 text-primary-foreground/60" : "border-accent/30 text-accent"
              }`}
            >
              {item.content.years_experience} yrs
            </Badge>
          )}
        </div>
        {kids.length > 0 && (
          <>
            <div className="w-0.5 h-6 bg-accent/50" />
            <div className="flex gap-6 relative">
              {kids.length > 1 && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-accent/40 rounded-full"
                  style={{ width: `${(kids.length - 1) * 100}%` }}
                />
              )}
              {kids.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-accent/40" />
                  {renderNode(child, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex justify-center gap-10 overflow-x-auto py-8 px-6 bg-primary/5 rounded-xl border border-primary/10">
      {roots.map((r) => renderNode(r, 0))}
    </div>
  );
}

export function StaffBiosTab() {
  const { data: items = [], isLoading } = useRfpContent("staff_bio");
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const deleteMutation = useDeleteRfpContent();
  const { toast } = useToast();
  const { data: profiles = [] } = useCompanyProfiles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffBioContent>(emptyBio);
  const [showOrgChart, setShowOrgChart] = useState(false);

  const existingNames = new Set(items.map((i) => (i.content as unknown as StaffBioContent).name?.toLowerCase()));
  const importableProfiles = profiles.filter((p) => {
    const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim().toLowerCase();
    return fullName && !existingNames.has(fullName);
  });

  const handleImportProfile = async (profile: typeof profiles[0]) => {
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    try {
      await createMutation.mutateAsync({
        content_type: "staff_bio",
        title: `${fullName} - ${profile.job_title || "Staff"}`,
        content: {
          name: fullName,
          title: profile.job_title || "",
          years_experience: null,
          years_with_company: null,
          bio: profile.about || "",
          hourly_rate: profile.hourly_rate ? Number(profile.hourly_rate) : null,
          percentage_on_project: null,
          certifications: [],
          education: [],
          reports_to: "",
          include_in_org_chart: true,
        } as any,
        tags: ["staff"],
      });
      toast({ title: `Imported ${fullName}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const staffNames = items.map((i) => (i.content as unknown as StaffBioContent).name).filter(Boolean);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyBio);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    const c = item.content as StaffBioContent;
    setForm({
      name: c.name || "",
      title: c.title || "",
      years_experience: c.years_experience ?? null,
      years_with_company: c.years_with_company ?? null,
      bio: c.bio || "",
      hourly_rate: c.hourly_rate ?? null,
      percentage_on_project: c.percentage_on_project ?? null,
      certifications: c.certifications || [],
      education: c.education || [],
      reports_to: c.reports_to || "",
      include_in_org_chart: c.include_in_org_chart !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          title: `${form.name} - ${form.title}`,
          content: form as any,
        });
      } else {
        await createMutation.mutateAsync({
          content_type: "staff_bio",
          title: `${form.name} - ${form.title}`,
          content: form as any,
          tags: [form.title?.toLowerCase().includes("principal") ? "principal" : "staff"],
        });
      }
      toast({ title: editingId ? "Staff bio updated" : "Staff bio added" });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Staff bio deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const parsedItems = items.map((i) => ({ id: i.id, content: i.content as unknown as StaffBioContent }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-amber" />
          <h3 className="text-lg font-semibold">Staff Bios</h3>
          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30">
            {items.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showOrgChart ? "default" : "outline"}
            size="sm"
            className={showOrgChart ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-amber" : ""}
            onClick={() => setShowOrgChart(!showOrgChart)}
          >
            <GitBranch className="h-4 w-4 mr-1" /> Org Chart
          </Button>
          {importableProfiles.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => importableProfiles.forEach(handleImportProfile)}>
              <Download className="h-4 w-4 mr-1" /> Import from Team ({importableProfiles.length})
            </Button>
          )}
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Staff Bio
          </Button>
        </div>
      </div>

      {showOrgChart && (
        <Card className="border-accent/20 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Organization Chart</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <OrgChart items={parsedItems} />
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No staff bios yet. Add your team members to include in RFP responses.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const c = item.content as unknown as StaffBioContent;
            return (
              <Card key={item.id} className="border-l-4 border-l-accent/60 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center ring-2 ring-accent/20">
                        <User className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{c.name}</p>
                          {c.include_in_org_chart !== false && (
                            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                              <GitBranch className="h-3 w-3 mr-0.5" /> Org Chart
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{c.title}</p>
                        {c.reports_to && (
                          <p className="text-xs text-muted-foreground">Reports to: <span className="text-info">{c.reports_to}</span></p>
                        )}
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {c.years_experience && (
                            <Badge variant="secondary" className="text-xs bg-accent/10 text-accent border border-accent/20">
                              {c.years_experience} yrs exp
                            </Badge>
                          )}
                          {c.hourly_rate && (
                            <Badge variant="outline" className="text-xs tabular-nums text-success border-success/30">
                              ${c.hourly_rate}/hr
                            </Badge>
                          )}
                          {c.certifications?.map((cert, i) => (
                            <Badge key={i} variant="secondary" className="text-xs bg-info/10 text-info border border-info/20">
                              {cert.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Staff Bio" : "Add Staff Bio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Principal" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Years Experience</Label>
                <Input
                  type="number"
                  value={form.years_experience ?? ""}
                  onChange={(e) => setForm({ ...form, years_experience: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="space-y-1">
                <Label>Years with Company</Label>
                <Input
                  type="number"
                  value={form.years_with_company ?? ""}
                  onChange={(e) => setForm({ ...form, years_with_company: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  value={form.hourly_rate ?? ""}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="space-y-1">
                <Label>% on Project</Label>
                <Input
                  type="number"
                  value={form.percentage_on_project ?? ""}
                  onChange={(e) => setForm({ ...form, percentage_on_project: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reports To</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.reports_to || ""}
                onChange={(e) => setForm({ ...form, reports_to: e.target.value })}
              >
                <option value="">None (Top Level)</option>
                {staffNames
                  .filter((n) => n !== form.name)
                  .map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.include_in_org_chart !== false}
                onCheckedChange={(checked) => setForm({ ...form, include_in_org_chart: checked })}
              />
              <Label className="text-sm">Include in Org Chart</Label>
            </div>
            <div className="space-y-1">
              <Label>Bio</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                placeholder="Brief professional biography..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editingId ? "Save Changes" : "Add Bio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
