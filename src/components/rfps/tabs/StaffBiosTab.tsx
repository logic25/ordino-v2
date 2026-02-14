import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, User, Download } from "lucide-react";
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
};

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

  // Find profiles not already in staff bios (by name match)
  const existingNames = new Set(items.map(i => (i.content as unknown as StaffBioContent).name?.toLowerCase()));
  const importableProfiles = profiles.filter(p => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase();
    return fullName && !existingNames.has(fullName);
  });

  const handleImportProfile = async (profile: typeof profiles[0]) => {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    try {
      await createMutation.mutateAsync({
        content_type: "staff_bio",
        title: `${fullName} - ${profile.job_title || 'Staff'}`,
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
        } as any,
        tags: ["staff"],
      });
      toast({ title: `Imported ${fullName}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Bios ({items.length})</h3>
        <div className="flex gap-2">
          {importableProfiles.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => importableProfiles.forEach(handleImportProfile)}>
              <Download className="h-4 w-4 mr-1" /> Import from Team ({importableProfiles.length})
            </Button>
          )}
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Staff Bio
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No staff bios yet. Add your team members to include in RFP responses.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const c = item.content as unknown as StaffBioContent;
            return (
              <Card key={item.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.title}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {c.years_experience && (
                            <Badge variant="secondary" className="text-xs">
                              {c.years_experience} yrs exp
                            </Badge>
                          )}
                          {c.hourly_rate && (
                            <Badge variant="outline" className="text-xs">
                              ${c.hourly_rate}/hr
                            </Badge>
                          )}
                          {c.certifications?.map((cert, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                      >
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
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
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
