import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Plus, Pencil, Trash2, Upload, FileImage, File,
  Download, Image as ImageIcon, Paperclip,
} from "lucide-react";
import {
  useRfpContent,
  useCreateRfpContent,
  useUpdateRfpContent,
  useDeleteRfpContent,
} from "@/hooks/useRfpContent";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AttachmentContent {
  file_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  description: string;
  tag: string;
}

const TAG_OPTIONS = [
  { value: "logo", label: "Logo" },
  { value: "insurance", label: "Insurance Certificate" },
  { value: "org_chart", label: "Org Chart" },
  { value: "other", label: "Other" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string) {
  return /^image\/(png|jpeg|jpg|gif|webp|svg)/.test(mime);
}

export function AttachmentsTab() {
  const { data: items = [], isLoading } = useRfpContent("attachment");
  const { data: companyData } = useCompanySettings();
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const deleteMutation = useDeleteRfpContent();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", tag: "other" });

  const hasLogo = items.some((i) => {
    const c = i.content as unknown as AttachmentContent;
    return c?.tag === "logo";
  });

  const handleUpload = async (file: File, tag = "other") => {
    setUploading(true);
    try {
      // Resolve the user's company_id so we can scope the upload path to it.
      // The rfp-documents bucket's RLS INSERT policy requires the first
      // folder segment to equal company_id; uploading without this prefix
      // historically failed silently and the file never made it onto outgoing
      // RFP emails as an attachment.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile, error: profErr } = await supabase
        .from("profiles").select("company_id").eq("user_id", user.id).single();
      if (profErr || !profile?.company_id) throw new Error("No company found");

      const ext = file.name.split(".").pop() || "";
      const path = `${profile.company_id}/attachments/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("rfp-documents")
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const content: AttachmentContent = {
        file_path: path,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        description: "",
        tag,
      };

      await createMutation.mutateAsync({
        title: file.name,
        content_type: "attachment",
        content: content as any,
      });

      toast({ title: "File uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onLogoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleUpload(file, "logo");
  };

  const handleDelete = async (id: string, filePath: string) => {
    try {
      await supabase.storage.from("rfp-documents").remove([filePath]);
      await deleteMutation.mutateAsync(id);
      toast({ title: "Attachment deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (item: typeof items[0]) => {
    const c = item.content as unknown as AttachmentContent;
    setEditingId(item.id);
    setEditForm({ description: c.description || "", tag: c.tag || "other" });
    setEditDialog(true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const item = items.find((i) => i.id === editingId);
    if (!item) return;
    const existing = item.content as unknown as AttachmentContent;

    await updateMutation.mutateAsync({
      id: editingId,
      content: { ...existing, description: editForm.description, tag: editForm.tag } as any,
    });
    setEditDialog(false);
    toast({ title: "Attachment updated" });
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from("rfp-documents")
      .createSignedUrl(path, 300);
    return data?.signedUrl;
  };

  const handleDownload = async (item: typeof items[0]) => {
    const c = item.content as unknown as AttachmentContent;
    const url = await getSignedUrl(c.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = c.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      {/* Logo prompt */}
      {!hasLogo && (
        <Card
          className="border-dashed border-2 border-primary/40 bg-primary/5 cursor-pointer hover:border-primary/60 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onLogoDrop}
        >
          <CardContent className="flex flex-col items-center gap-2 py-8">
            <ImageIcon className="h-10 w-10 text-primary/60" />
            <p className="text-sm font-medium text-foreground">Add your company logo</p>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Drag &amp; drop your logo here, or click to upload. This will be available for all RFP responses.
              {companyData?.logo_url && (
                <span className="block mt-1 text-primary">
                  Tip: Your company logo is set in settings — upload it here to include in RFP attachments.
                </span>
              )}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={uploading}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (ev) => {
                  const f = (ev.target as HTMLInputElement).files?.[0];
                  if (f) await handleUpload(f, "logo");
                };
                input.click();
              }}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload Logo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} attachment{items.length !== 1 ? "s" : ""}
        </p>
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={onFileChange}
          />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Upload File
          </Button>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 && hasLogo ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No attachments yet. Upload insurance certs, org charts, or other RFP files.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => {
            const c = item.content as unknown as AttachmentContent;
            const isImage = isImageMime(c.mime_type);
            const tag = TAG_OPTIONS.find((t) => t.value === c.tag);

            return (
              <Card key={item.id} className="group relative">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 h-10 w-10 rounded bg-muted flex items-center justify-center">
                      {isImage ? (
                        <FileImage className="h-5 w-5 text-primary" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.filename}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(c.size_bytes)}</p>
                    </div>
                  </div>

                  {tag && (
                    <Badge variant="secondary" className="text-xs">
                      {tag.label}
                    </Badge>
                  )}

                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  )}

                  <div className="flex gap-1 pt-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownload(item)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id, c.file_path)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attachment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tag</Label>
              <Select value={editForm.tag} onValueChange={(v) => setEditForm((f) => ({ ...f, tag: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. General liability insurance cert, expires 2026"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
