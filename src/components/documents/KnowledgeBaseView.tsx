import { useState, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FileText, FolderOpen, Upload, Loader2, AlertCircle, File, MoreVertical, FolderInput, RotateCcw, Trash2,
} from "lucide-react";
import { useBeaconKnowledge, useUploadToBeaconKB } from "@/hooks/useBeaconKnowledge";
import { useBeaconKbOverrides, useUpsertBeaconKbOverride, useClearBeaconKbOverride } from "@/hooks/useBeaconKbOverrides";
import { FOLDER_TO_SOURCE_TYPE, assignBeaconFolders, deleteBeaconDoc } from "@/services/beaconApi";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { RecentlyDeletedKb } from "./RecentlyDeletedKb";
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
  const qc = useQueryClient();
  const { data, isLoading, isError } = useBeaconKnowledge();
  const { data: overrides = [] } = useBeaconKbOverrides();
  const upsertOverride = useUpsertBeaconKbOverride();
  const clearOverride = useClearBeaconKbOverride();
  const upload = useUploadToBeaconKB();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolder, setTargetFolder] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [moveFolderInput, setMoveFolderInput] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Build override map: source_file -> { display_folder, hidden_from_original }
  const overrideMap = useMemo(() => {
    const m = new Map<string, { display_folder: string; hidden: boolean }>();
    for (const o of overrides) {
      m.set(o.source_file, { display_folder: o.display_folder, hidden: o.hidden_from_original });
    }
    return m;
  }, [overrides]);

  // Folders coming from the Beacon API (slug form)
  const apiFolderNames = useMemo(() => {
    const apiFolders = data ? Object.keys(data.folders) : [];
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

  // Compute effective folder -> files map by applying overrides.
  // Keys: humanized display names. Values: array of filenames.
  const effectiveFolders = useMemo(() => {
    const out = new Map<string, Set<string>>();
    // 1. Seed with API folders (humanized), applying "hide from original"
    for (const slug of apiFolderNames) {
      const human = humanize(slug);
      const files = data?.folders[slug] || [];
      const filtered = files.filter((f) => {
        const ov = overrideMap.get(f);
        return !(ov && ov.hidden);
      });
      if (filtered.length > 0 || !overrideMap.size) {
        out.set(human, new Set(filtered));
      } else {
        out.set(human, new Set(filtered));
      }
    }
    // 2. Apply overrides — add file into its override display_folder
    for (const [source_file, ov] of overrideMap.entries()) {
      const folder = ov.display_folder;
      if (!out.has(folder)) out.set(folder, new Set());
      out.get(folder)!.add(source_file);
    }
    return out;
  }, [apiFolderNames, data, overrideMap]);

  // Active folder filter — match by humanized name (so "Spring Valley" works)
  const visibleFolderNames = useMemo(() => {
    if (!externalActiveFolder) return Array.from(effectiveFolders.keys()).sort();
    // exact humanized match first, then fallback to slug humanize
    const target = externalActiveFolder;
    const slug = DISPLAY_TO_SLUG[target];
    const slugHuman = slug ? humanize(slug) : null;
    return Array.from(effectiveFolders.keys()).filter(
      (name) => name === target || (slugHuman && name === slugHuman)
    );
  }, [effectiveFolders, externalActiveFolder]);

  // Folder choices for the Move dialog: humanized API folders + every override display_folder
  const moveFolderChoices = useMemo(() => {
    const set = new Set<string>();
    for (const slug of apiFolderNames) set.add(humanize(slug));
    for (const ov of overrides) set.add(ov.display_folder);
    return Array.from(set).sort();
  }, [apiFolderNames, overrides]);

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

  const handleConfirmMove = async () => {
    if (!moveTarget || !moveFolderInput.trim()) return;
    setMoveSaving(true);
    const target = moveFolderInput.trim();
    // Convert humanized folder name back to slug when it matches a known Beacon folder.
    const slugFromHuman = Object.keys(FOLDER_TO_SOURCE_TYPE).find((slug) => humanize(slug) === target);
    const backendFolder = slugFromHuman || target;
    try {
      // 1. Real backend move — in-place, no re-ingest, no duplicates.
      await assignBeaconFolders({ [moveTarget]: backendFolder });
      // 2. Clear any prior display-layer override (the backend is now source of truth).
      try {
        await clearOverride.mutateAsync(moveTarget);
      } catch {
        /* no-op — override may not exist */
      }
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
      toast({ title: "Moved", description: `Now in "${target}"` });
      setMoveTarget(null);
      setMoveFolderInput("");
    } catch (err: any) {
      // Fallback: if the backend rejects (older deploy), fall back to display-only override
      // so the user still sees the file in the chosen folder.
      try {
        await upsertOverride.mutateAsync({
          source_file: moveTarget,
          display_folder: target,
          hidden_from_original: true,
          notes: `fallback (backend error: ${err.message || "unknown"})`,
        });
        toast({
          title: "Moved (display only)",
          description: "Backend rejected the request — applied display-layer override instead.",
        });
        setMoveTarget(null);
        setMoveFolderInput("");
      } catch (e: any) {
        toast({ title: "Move failed", description: e.message || err.message, variant: "destructive" });
      }
    } finally {
      setMoveSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteBeaconDoc(deleteTarget);
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
      qc.invalidateQueries({ queryKey: ["kb-deleted-documents"] });
      toast({ title: "Deleted", description: "Backed up — restorable from Recently Deleted." });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleteSaving(false);
    }
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
              <p className="text-2xl font-bold">{effectiveFolders.size}</p>
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
          {visibleFolderNames.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No files in this folder yet.
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={visibleFolderNames} className="w-full">
              {visibleFolderNames.map((folderName) => {
                const files = Array.from(effectiveFolders.get(folderName) || []);
                return (
                  <AccordionItem key={folderName} value={folderName}>
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                        <span className="font-medium">{folderName}</span>
                        <Badge variant="secondary" className="text-xs ml-1">{files.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-1 pl-6">
                        {files.sort().map((filename) => {
                          const ov = overrideMap.get(filename);
                          return (
                            <div
                              key={filename}
                              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm group"
                            >
                              <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <button
                                type="button"
                                className="truncate flex-1 text-left cursor-pointer"
                                onClick={() => setViewingFile(filename)}
                              >
                                {filename}
                              </button>
                              {ov && (
                                <Badge variant="outline" className="text-[10px] opacity-70">moved</Badge>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-60 hover:opacity-100"
                                    title="More actions"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setMoveTarget(filename);
                                      setMoveFolderInput(ov?.display_folder || "");
                                    }}
                                  >
                                    <FolderInput className="h-3.5 w-3.5 mr-2" /> Move to folder…
                                  </DropdownMenuItem>
                                  {ov && (
                                    <DropdownMenuItem
                                      onClick={() => clearOverride.mutate(filename)}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset to original folder
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(filename)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete…
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <RecentlyDeletedKb />

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
                  {apiFolderNames.filter((f) => f !== "_root").map((f) => (
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

      {/* Move dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(open) => { if (!open) { setMoveTarget(null); setMoveFolderInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription className="text-xs">
              Changes where this file appears in the Knowledge Base view. The Beacon backend keeps the
              original chunks indexed (no re-ingest, no duplicates) — this only changes how it's displayed here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">File</Label>
              <p className="text-sm font-medium break-all">{moveTarget}</p>
            </div>
            <div>
              <Label>Target folder</Label>
              <Input
                value={moveFolderInput}
                onChange={(e) => setMoveFolderInput(e.target.value)}
                placeholder='e.g. "Spring Valley"'
                className="mt-1"
                list="kb-folder-suggestions"
              />
              <datalist id="kb-folder-suggestions">
                {moveFolderChoices.map((f) => <option key={f} value={f} />)}
              </datalist>
              <p className="text-[11px] text-muted-foreground mt-1">
                Pick an existing folder or type a new name (e.g. a jurisdiction).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoveTarget(null); setMoveFolderInput(""); }}>Cancel</Button>
            <Button onClick={handleConfirmMove} disabled={!moveFolderInput.trim() || upsertOverride.isPending}>
              {upsertOverride.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderInput className="h-4 w-4 mr-2" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <BeaconDocumentModal
          open={!!viewingFile}
          onClose={() => setViewingFile(null)}
          sourceFile={viewingFile || ""}
        />
      </Suspense>
    </div>
  );
}
