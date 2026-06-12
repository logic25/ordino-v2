import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Paperclip, Upload, Trash2, Loader2, Download } from "lucide-react";
import type { PermitPlaybook } from "@/hooks/usePermitPlaybooks";
import {
  useUploadAttachment, useDeleteAttachment, getAttachmentUrl,
} from "@/hooks/usePermitPlaybooks";
import { useToast } from "@/hooks/use-toast";

export default function AttachmentsPanel({ playbook }: { playbook: PermitPlaybook }) {
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ playbook, file });
      } catch (e: any) {
        toast({ title: `Upload failed: ${file.name}`, description: e?.message, variant: "destructive" });
      }
    }
  };

  const handleDownload = async (path: string, name: string) => {
    try {
      const url = await getAttachmentUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" /> Attachments
      </div>

      <div
        className={`rounded-md border-2 border-dashed p-4 text-center text-sm transition cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? (
          <span className="inline-flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading…</span>
        ) : (
          <span className="text-muted-foreground inline-flex items-center"><Upload className="h-4 w-4 mr-2" /> Drag files here or click to upload</span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {playbook.attachments.length === 0 && (
        <div className="text-sm text-muted-foreground italic">No attachments yet.</div>
      )}
      <div className="space-y-1.5">
        {playbook.attachments.map((a) => (
          <Card key={a.id} className="p-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{a.name}</div>
              <div className="text-xs text-muted-foreground">
                {a.size ? `${(a.size / 1024).toFixed(1)} KB · ` : ""}
                {new Date(a.uploaded_at).toLocaleDateString()}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => handleDownload(a.storage_path, a.name)} aria-label="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="ghost"
              onClick={() => del.mutate({ playbook, attachmentId: a.id })}
              aria-label="Delete attachment"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
