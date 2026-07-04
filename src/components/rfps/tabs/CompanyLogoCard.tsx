import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import {
  useRfpContent,
  useCreateRfpContent,
  useDeleteRfpContent,
} from "@/hooks/useRfpContent";
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

/**
 * Logo upload surface on the Company tab of the RFP Content Library.
 * Persists to the same rfp-documents bucket / rfp_content table that the
 * Files tab uses, so an uploaded logo is automatically attached to outgoing
 * RFP responses regardless of which tab the user uploaded it on.
 */
export function CompanyLogoCard() {
  const { data: items = [], isLoading } = useRfpContent("attachment");
  const createMutation = useCreateRfpContent();
  const deleteMutation = useDeleteRfpContent();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const logoItem = items.find(
    (i) => (i.content as unknown as AttachmentContent)?.tag === "logo",
  );
  const logoContent = logoItem?.content as unknown as AttachmentContent | undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!logoContent?.file_path) {
        setPreviewUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("rfp-documents")
        .createSignedUrl(logoContent.file_path, 600);
      if (!cancelled) setPreviewUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoContent?.file_path]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
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
        description: "Company logo",
        tag: "logo",
      };

      await createMutation.mutateAsync({
        title: file.name,
        content_type: "attachment",
        content: content as any,
      });

      toast({ title: "Logo uploaded" });
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

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleUpload(file);
  };

  const handleDelete = async () => {
    if (!logoItem || !logoContent) return;
    try {
      await supabase.storage.from("rfp-documents").remove([logoContent.file_path]);
      await deleteMutation.mutateAsync(logoItem.id);
      toast({ title: "Logo removed" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Company Logo</CardTitle>
        {logoItem && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Remove
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={onFileChange}
        />
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logoItem ? (
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded border bg-muted flex items-center justify-center overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="Company logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{logoContent?.filename}</p>
              <p className="text-xs text-muted-foreground mb-2">
                Attached to outgoing RFP responses.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Replace
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-primary/40 bg-primary/5 rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-primary/60" />
            <p className="text-sm font-medium">Upload your company logo</p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WEBP or SVG. Drag &amp; drop or click to browse.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload Logo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
