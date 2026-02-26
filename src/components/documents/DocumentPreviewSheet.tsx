import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, X, Pencil, Eye, Save, Loader2, Brain, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import type { UniversalDocument } from "@/hooks/useUniversalDocuments";
import { syncDocumentToBeacon } from "@/services/beaconApi";

interface Props {
  document: UniversalDocument | null;
  open: boolean;
  onClose: () => void;
  isBeaconFolder?: boolean;
  folderName?: string;
  isAdmin?: boolean;
}

type ViewMode = "preview" | "edit";

function getPreviewType(mime: string | null, filename: string): "pdf" | "image" | "text" | "markdown" | "html" | "unsupported" {
  if (mime?.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "htm" || mime === "text/html") return "html";
  if (ext === "md") return "markdown";
  if (ext === "txt" || ext === "csv" || ext === "json" || ext === "xml" || ext === "yaml" || ext === "yml" || ext === "log") return "text";
  if (mime?.startsWith("text/")) return "text";
  return "unsupported";
}

function getBucketForPath(storagePath: string): string {
  // Proposals and some docs are stored in the "documents" bucket
  if (storagePath.startsWith("proposals/")) return "documents";
  return "universal-documents";
}

export function DocumentPreviewSheet({ document: doc, open, onClose, isBeaconFolder, folderName, isAdmin }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<ViewMode>("preview");
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const previewType = doc ? getPreviewType(doc.mime_type, doc.filename) : "unsupported";
  const isEditable = previewType === "text" || previewType === "markdown";
  const bucket = doc ? getBucketForPath(doc.storage_path) : "universal-documents";

  useEffect(() => {
    if (!doc || !open) return;
    setMode("preview");
    setContent("");
    setOriginalContent("");
    setSignedUrl(null);

    if (previewType === "pdf" || previewType === "image" || previewType === "html") {
      supabase.storage.from(bucket).createSignedUrl(doc.storage_path, 3600)
        .then(({ data }) => { if (data) setSignedUrl(data.signedUrl); });
    }

    if (isEditable) {
      setLoading(true);
      supabase.storage.from(bucket).download(doc.storage_path)
        .then(async ({ data, error }) => {
          if (error || !data) return;
          const text = await data.text();
          setContent(text);
          setOriginalContent(text);
        })
        .finally(() => setLoading(false));
    }
  }, [doc?.id, open]);

  const handleDownload = async () => {
    if (!doc) return;
    const { data, error } = await supabase.storage.from(bucket).download(doc.storage_path);
    if (error || !data) { toast({ title: "Download failed", variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = window.document.createElement("a");
    a.href = url; a.download = doc.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const blob = new Blob([content], { type: doc.mime_type || "text/plain" });
      const { error } = await supabase.storage.from(bucket)
        .update(doc.storage_path, blob, { upsert: true });
      if (error) throw error;

      // Update timestamp
      await supabase.from("universal_documents").update({ updated_at: new Date().toISOString() } as any).eq("id", doc.id);

      // Beacon sync if in beacon folder
      if (isBeaconFolder) {
        try {
          await supabase.from("universal_documents").update({ beacon_status: "pending" } as any).eq("id", doc.id);
          const result = await syncDocumentToBeacon(blob, doc.filename, folderName || "Beacon Knowledge Base");
          await supabase.from("universal_documents").update({
            beacon_status: "synced",
            beacon_synced_at: new Date().toISOString(),
            beacon_chunks: result.chunks_created,
          } as any).eq("id", doc.id);
          toast({ title: "Saved and synced to Beacon" });
        } catch {
          await supabase.from("universal_documents").update({ beacon_status: "error" } as any).eq("id", doc.id);
          toast({ title: "Saved, but Beacon sync failed", variant: "destructive" });
        }
      } else {
        toast({ title: "Saved" });
      }

      setOriginalContent(content);
      setMode("preview");
      qc.invalidateQueries({ queryKey: ["universal-documents"] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploaderName = doc?.uploader?.display_name ||
    [doc?.uploader?.first_name, doc?.uploader?.last_name].filter(Boolean).join(" ") || "—";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[60vw] overflow-y-auto p-0">
        {doc && (
          <>
            <SheetHeader className="p-4 pb-3 pr-14 border-b space-y-2">
              <div className="flex items-start justify-between gap-2">
                <SheetTitle className="text-lg">{doc.title}</SheetTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditable && (!isBeaconFolder || isAdmin) && mode === "preview" && (
                    <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                <span>{uploaderName}</span>
                <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                {doc.size_bytes && <span>{(doc.size_bytes / 1024).toFixed(0)} KB</span>}
                {isBeaconFolder && (
                  <Badge className="bg-[#f59e0b] text-white text-[10px]">
                    <Brain className="h-2.5 w-2.5 mr-0.5" />
                    {(doc as any).beacon_status === "synced" ? `Synced (${(doc as any).beacon_chunks || 0} chunks)` : (doc as any).beacon_status || "Not synced"}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="p-4">
              {isEditable && mode === "edit" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setMode("preview")} className="text-xs">
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                    <span className="text-xs text-muted-foreground">Editing: {doc.filename}</span>
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setContent(originalContent); setMode("preview"); }}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || content === originalContent}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : previewType === "pdf" && signedUrl ? (
                <iframe src={signedUrl} className="w-full h-[70vh] rounded border" />
              ) : previewType === "html" && signedUrl ? (
                <iframe src={signedUrl} className="w-full h-[70vh] rounded border bg-white" sandbox="allow-same-origin" />
              ) : previewType === "image" && signedUrl ? (
                <img src={signedUrl} alt={doc.title} className="max-w-full rounded border" />
              ) : previewType === "markdown" ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : previewType === "text" ? (
                <pre className="text-sm font-mono whitespace-pre-wrap bg-muted rounded p-4">{content}</pre>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" /> Download File
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
