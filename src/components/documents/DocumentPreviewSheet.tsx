import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, X, Pencil, Eye, Save, Loader2, Brain, RefreshCw, History, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import type { UniversalDocument } from "@/hooks/useUniversalDocuments";
import { useDocumentVersions, versionChangerName, type DocumentVersion } from "@/hooks/useDocumentVersions";
import { useAuth } from "@/hooks/useAuth";
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
  const { profile } = useAuth();
  const [mode, setMode] = useState<ViewMode>("preview");
  const [panel, setPanel] = useState<"doc" | "history">("doc");
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const versions = useDocumentVersions(doc?.id);
  const versionCount = versions.data?.length || 0;

  const previewType = doc ? getPreviewType(doc.mime_type, doc.filename) : "unsupported";
  const isEditable = previewType === "text" || previewType === "markdown";
  const bucket = doc ? getBucketForPath(doc.storage_path) : "universal-documents";

  useEffect(() => {
    if (!doc || !open) return;
    setMode("preview");
    setPanel("doc");
    setContent("");
    setOriginalContent("");
    setSignedUrl(null);

    if (previewType === "pdf" || previewType === "image") {
      supabase.storage.from(bucket).createSignedUrl(doc.storage_path, 3600)
        .then(({ data }) => { if (data) setSignedUrl(data.signedUrl); });
    }

    if (previewType === "html") {
      // Download HTML and render via blob URL to ensure proper rendering
      supabase.storage.from(bucket).download(doc.storage_path)
        .then(async ({ data, error }) => {
          if (error || !data) return;
          const text = await data.text();
          setContent(text);
          const blob = new Blob([text], { type: "text/html" });
          setSignedUrl(URL.createObjectURL(blob));
        });
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
      // Snapshot the PRIOR content to a versioned path before overwriting in place,
      // so file-content history is preserved (the live file is upserted below).
      // Non-fatal: a snapshot failure must not block the save.
      try {
        if (originalContent && originalContent !== content) {
          const { data: maxV } = await (supabase as any)
            .from("document_versions")
            .select("version")
            .eq("document_id", doc.id)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextVersion = ((maxV?.version as number) || 0) + 1;
          // Both universal-documents and documents buckets require the first
          // folder segment to equal company_id (RLS INSERT policy). Without
          // this prefix the upload is rejected and version history is lost.
          const versionPath = `${doc.company_id}/versions/${doc.id}/v${nextVersion}-${doc.filename}`;
          const oldBlob = new Blob([originalContent], { type: doc.mime_type || "text/plain" });
          await supabase.storage.from(bucket).upload(versionPath, oldBlob, { upsert: true });
          await (supabase as any).from("document_versions").insert({
            document_id: doc.id,
            company_id: doc.company_id,
            version: nextVersion,
            title: doc.title,
            description: doc.description,
            category: doc.category,
            jurisdiction: (doc as any).jurisdiction,
            storage_path: versionPath,
            changed_by: profile?.id || null,
          });
        }
      } catch (e) {
        console.warn("[DocumentVersion] content snapshot failed", e);
      }

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
      qc.invalidateQueries({ queryKey: ["document-versions", doc.id] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadVersion = async (v: DocumentVersion) => {
    if (!v.storage_path) return;
    const { data, error } = await supabase.storage.from(bucket).download(v.storage_path);
    if (error || !data) { toast({ title: "Couldn't load that version", variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = window.document.createElement("a");
    a.href = url; a.download = `v${v.version}-${doc?.filename || "document"}`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreVersion = async (v: DocumentVersion) => {
    if (!doc || !v.storage_path) return;
    const { data, error } = await supabase.storage.from(bucket).download(v.storage_path);
    if (error || !data) { toast({ title: "Couldn't load that version", variant: "destructive" }); return; }
    const text = await data.text();
    setContent(text);
    setMode("edit");
    setPanel("doc");
    toast({ title: `Loaded version ${v.version}`, description: "Review, then Save to restore it as the current version." });
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
                  {isEditable && (!isBeaconFolder || isAdmin) && mode === "preview" && panel === "doc" && (
                    <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPanel(panel === "history" ? "doc" : "history")}>
                    <History className="h-3.5 w-3.5 mr-1" />
                    {panel === "history" ? "Back" : "History"}
                    {panel === "doc" && versionCount > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1">{versionCount}</Badge>
                    )}
                  </Button>
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
              {panel === "history" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Every saved edit snapshots the prior version here — what changed, who, and when.
                  </p>
                  {versions.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : versionCount === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      No earlier versions yet. Future edits will appear here.
                    </p>
                  ) : (
                    versions.data!.map((v) => {
                      const isFileSnap = !!v.storage_path?.includes("versions/");
                      return (
                        <div key={v.id} className="flex items-start justify-between gap-3 border rounded-md p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">Version {v.version}</div>
                            <div className="text-xs text-muted-foreground">
                              {versionChangerName(v)} · {format(new Date(v.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {[v.title, v.category, v.jurisdiction].filter(Boolean).join(" · ")}
                              {!isFileSnap && " · metadata change"}
                            </div>
                          </div>
                          {isFileSnap && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => handleDownloadVersion(v)} title="Download this version">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {isEditable && (!isBeaconFolder || isAdmin) && (
                                <Button variant="outline" size="sm" onClick={() => handleRestoreVersion(v)}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : isEditable && mode === "edit" ? (
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
