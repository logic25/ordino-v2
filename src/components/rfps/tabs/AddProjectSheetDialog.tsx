import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCreateProjectSheet, uploadProjectPhoto, getProjectPhotoUrl } from "@/hooks/useProjectSheets";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

export function AddProjectSheetDialog({ open, onOpenChange }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const createMutation = useCreateProjectSheet();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [refName, setRefName] = useState("");
  const [refTitle, setRefTitle] = useState("");
  const [refEmail, setRefEmail] = useState("");
  const [refPhone, setRefPhone] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setClientName(""); setLocation("");
    setCompletionDate(""); setEstimatedValue(""); setRefName(""); setRefTitle("");
    setRefEmail(""); setRefPhone(""); setPhotos([]);
  };

  const handleUpload = async (files: FileList | File[]) => {
    if (!profile?.company_id) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) continue;
        if (file.size > 10 * 1024 * 1024) continue;
        const path = await uploadProjectPhoto(profile.company_id, file);
        paths.push(path);
      }
      setPhotos((prev) => [...prev, ...paths]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  }, [profile?.company_id]);

  const removePhoto = (path: string) => setPhotos((prev) => prev.filter((p) => p !== path));

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description || null,
        client_name: clientName || null,
        location: location || null,
        completion_date: completionDate || null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        tags: [],
        reference_contact_name: refName || null,
        reference_contact_title: refTitle || null,
        reference_contact_email: refEmail || null,
        reference_contact_phone: refPhone || null,
        reference_notes: null,
        photos,
        documents: [],
      });
      toast({ title: "Project sheet added" });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Project Sheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 123 Main St — Full Building Renovation" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the scope, challenges, and outcomes…" rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or owner" />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address or borough" />
            </div>
            <div className="space-y-1.5">
              <Label>Completion Date</Label>
              <Input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Value</Label>
              <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="$" />
            </div>
          </div>

          {/* Photos upload */}
          <div className="space-y-2">
            <Label>Photos & Documents</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
                dragOver ? "border-accent bg-accent/5" : "border-muted-foreground/25 hover:border-muted-foreground/40"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = ACCEPTED_TYPES.join(",");
                input.onchange = (e) => {
                  const t = e.target as HTMLInputElement;
                  if (t.files?.length) handleUpload(t.files);
                };
                input.click();
              }}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Uploading…</span>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
                  <p className="text-sm text-muted-foreground">Drop photos/PDFs here or click to browse</p>
                  <p className="text-xs text-muted-foreground/60">PNG, JPG, WebP, PDF · Max 10MB each</p>
                </>
              )}
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => {
                  const url = getProjectPhotoUrl(p);
                  const isPdf = p.endsWith(".pdf");
                  return (
                    <div key={p} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
                      {isPdf ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(p); }}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reference contact */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Reference Contact (optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Contact name" />
              <Input value={refTitle} onChange={(e) => setRefTitle(e.target.value)} placeholder="Title" />
              <Input value={refEmail} onChange={(e) => setRefEmail(e.target.value)} placeholder="Email" />
              <Input value={refPhone} onChange={(e) => setRefPhone(e.target.value)} placeholder="Phone" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Add Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
