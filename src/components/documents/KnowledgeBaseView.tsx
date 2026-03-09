import { useState, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText, FolderOpen, Upload, Loader2, AlertCircle, File,
} from "lucide-react";
import { useBeaconKnowledge, useUploadToBeaconKB } from "@/hooks/useBeaconKnowledge";
import { FOLDER_TO_SOURCE_TYPE } from "@/services/beaconApi";
import { useToast } from "@/hooks/use-toast";
import { lazy, Suspense } from "react";
const BeaconDocumentModal = lazy(() => import("./BeaconDocumentModal").then(m => ({ default: m.BeaconDocumentModal })));

function humanize(slug: string): string {
  if (slug === "_root") return "Root";
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface KnowledgeBaseViewProps {
  activeFolder?: string | null;
}

export function KnowledgeBaseView({ activeFolder: externalActiveFolder }: KnowledgeBaseViewProps) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useBeaconKnowledge();
  const upload = useUploadToBeaconKB();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolder, setTargetFolder] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const folderNames = useMemo(() => {
    const apiFolders = data ? Object.keys(data.folders) : [];
    // Always include known folders so the upload dropdown works even if KB is empty
    const knownFolders = Object.keys(FOLDER_TO_SOURCE_TYPE);
    const merged = new Set([...apiFolders, ...knownFolders]);
    merged.delete("_root");
    return Array.from(merged).sort();
  }, [data]);

  // Map display folder name to slug for filtering
  const DISPLAY_TO_SLUG: Record<string, string> = {
    "Filing Guides": "filing_guides",
    "Service Notices": "service_notices",
    "Buildings Bulletins": "buildings_bulletins",
    "Policy Memos": "policy_memos",
    "Codes": "codes",
    "Determinations": "determinations",
    "Company SOPs": "company_sops",
    "Objections": "objections",
  };

  const resolvedActiveFolder = externalActiveFolder
    ? DISPLAY_TO_SLUG[externalActiveFolder] || externalActiveFolder.toLowerCase().replace(/\s+/g, '_')
    : null;

  const visibleFolders = resolvedActiveFolder
    ? folderNames.filter((f) => f === resolvedActiveFolder)
    : folderNames;

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !targetFolder) return;
    setUploadProgress({ done: 0, total: selectedFiles.length });
    let successCount = 0;
    let totalChunks = 0;
    for (const file of selectedFiles) {
      try {
        const result = await upload.mutateAsync({ file, folder: targetFolder });
        totalChunks += result.chunks_created || 0;
        successCount++;
        setUploadProgress({ done: successCount, total: selectedFiles.length });
      } catch (err: any) {
        toast({ title: `Failed: ${file.name}`, description: err.message, variant: "destructive" });
      }
    }
    if (successCount > 0) {
      toast({ title: "Uploaded to Knowledge Base", description: `${successCount} file(s), ${totalChunks} chunks created` });
    }
    setUploadOpen(false);
    setSelectedFiles([]);
    setTargetFolder("");
    setUploadProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
        <h3 className="text-lg font-medium">Beacon API Unreachable</h3>
        <p className="text-muted-foreground mt-1">Could not connect to the Beacon knowledge base. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[hsl(var(--chart-4))]/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-[hsl(var(--chart-4))]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.total_files}</p>
              <p className="text-xs text-muted-foreground">Total Documents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[hsl(var(--chart-2))]/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-[hsl(var(--chart-2))]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.folder_count}</p>
              <p className="text-xs text-muted-foreground">Folders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> Upload to Knowledge Base
        </Button>
      </div>

      {/* Folder accordion */}
      <Card>
        <CardContent className="p-4">
          <Accordion type="multiple" className="w-full">
            {visibleFolders.map((folder) => {
              const files = data?.folders[folder] || [];
              return (
                <AccordionItem key={folder} value={folder}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                      <span className="font-medium">{humanize(folder)}</span>
                      <Badge variant="secondary" className="text-xs ml-1">{files.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-1 pl-6">
                      {files.sort().map((filename) => (
                        <div
                          key={filename}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm cursor-pointer"
                          onClick={() => setViewingFile(filename)}
                        >
                          <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{filename}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => {
        setUploadOpen(open);
        if (!open) { setSelectedFiles([]); setTargetFolder(""); setUploadProgress(null); if (fileRef.current) fileRef.current.value = ""; }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload to Knowledge Base</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Files (PDF, MD, or TXT — select multiple)</Label>
              <Input ref={fileRef} type="file" accept=".pdf,.md,.txt" multiple className="mt-1" onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
              {selectedFiles.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">{selectedFiles.length} files selected</p>
              )}
            </div>
            <div>
              <Label>Target Folder</Label>
              <Select value={targetFolder} onValueChange={setTargetFolder}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select folder..." /></SelectTrigger>
                <SelectContent>
                  {folderNames.filter((f) => f !== "_root").map((f) => (
                    <SelectItem key={f} value={f}>{humanize(f)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetFolder && FOLDER_TO_SOURCE_TYPE[targetFolder] && (
                <p className="text-xs text-muted-foreground mt-1">Source type: {FOLDER_TO_SOURCE_TYPE[targetFolder]}</p>
              )}
            </div>
            {uploadProgress && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{uploadProgress.done} / {uploadProgress.total} files uploaded</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || !targetFolder || !!uploadProgress}>
              {uploadProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload {selectedFiles.length > 1 ? `${selectedFiles.length} Files` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BeaconDocumentModal
        open={!!viewingFile}
        onClose={() => setViewingFile(null)}
        sourceFile={viewingFile || ""}
      />
    </div>
  );
}
