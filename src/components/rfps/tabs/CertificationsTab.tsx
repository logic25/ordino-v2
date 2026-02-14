import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Award, AlertTriangle } from "lucide-react";
import { useRfpContent, useCreateRfpContent, useUpdateRfpContent, useDeleteRfpContent } from "@/hooks/useRfpContent";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, differenceInDays } from "date-fns";

interface CertContent {
  cert_type: string;
  cert_number: string;
  issuing_agency: string;
  issue_date: string;
  expiration_date: string;
  holder_name?: string;
}

export function CertificationsTab() {
  const { data: items = [], isLoading } = useRfpContent("certification");
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const deleteMutation = useDeleteRfpContent();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CertContent & { title: string }>({
    title: "",
    cert_type: "",
    cert_number: "",
    issuing_agency: "",
    issue_date: "",
    expiration_date: "",
    holder_name: "",
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ title: "", cert_type: "", cert_number: "", issuing_agency: "", issue_date: "", expiration_date: "", holder_name: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    const c = item.content as CertContent;
    setEditingId(item.id);
    setForm({
      title: item.title,
      cert_type: c.cert_type || "",
      cert_number: c.cert_number || "",
      issuing_agency: c.issuing_agency || "",
      issue_date: c.issue_date || "",
      expiration_date: c.expiration_date || "",
      holder_name: c.holder_name || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const { title, ...certContent } = form;
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, title, content: certContent as any });
      } else {
        await createMutation.mutateAsync({
          content_type: "certification",
          title,
          content: certContent as any,
          tags: certContent.cert_type?.toLowerCase().includes("mbe") ? ["mwbe", "all_agencies"] : ["all_agencies"],
        });
      }
      toast({ title: editingId ? "Certification updated" : "Certification added" });
      setDialogOpen(false);
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
        <h3 className="text-lg font-semibold">Certifications & Licenses ({items.length})</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Certification
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No certifications yet. Add M/WBE certs, licenses, and insurance documents.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const c = item.content as unknown as CertContent;
            const expired = c.expiration_date ? isPast(new Date(c.expiration_date)) : false;
            const daysLeft = c.expiration_date ? differenceInDays(new Date(c.expiration_date), new Date()) : null;

            return (
              <Card key={item.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.cert_type} #{c.cert_number}
                        </p>
                        {c.holder_name && (
                          <p className="text-sm text-muted-foreground">{c.holder_name}</p>
                        )}
                        {c.issuing_agency && (
                          <p className="text-xs text-muted-foreground mt-0.5">{c.issuing_agency}</p>
                        )}
                        <div className="flex gap-2 mt-1.5">
                          {c.expiration_date && (
                            <Badge
                              variant={expired ? "destructive" : daysLeft !== null && daysLeft < 90 ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {expired ? (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Expired
                                </>
                              ) : (
                                `Expires ${format(new Date(c.expiration_date), "MMM d, yyyy")}`
                              )}
                            </Badge>
                          )}
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
                        onClick={async () => {
                          try {
                            await deleteMutation.mutateAsync(item.id);
                            toast({ title: "Deleted" });
                          } catch (e: any) {
                            toast({ title: "Error", description: e.message, variant: "destructive" });
                          }
                        }}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Certification" : "Add Certification"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="M/WBE Certification" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Input value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} placeholder="MBE" />
              </div>
              <div className="space-y-1">
                <Label>Number</Label>
                <Input value={form.cert_number} onChange={(e) => setForm({ ...form, cert_number: e.target.value })} placeholder="MWCERT2016-41" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Issuing Agency</Label>
              <Input value={form.issuing_agency} onChange={(e) => setForm({ ...form, issuing_agency: e.target.value })} placeholder="NYC DSBS" />
            </div>
            <div className="space-y-1">
              <Label>Holder Name</Label>
              <Input value={form.holder_name || ""} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} placeholder="Manny Russell" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Expiration Date</Label>
                <Input type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editingId ? "Save" : "Add Certification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
