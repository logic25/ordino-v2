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
  FileText, FolderOpen, Upload, Loader2, AlertCircle, File, MoreVertical, FolderInput, RotateCcw, Trash2, Pencil, Search, ArrowUpDown, AlertTriangle,
} from "lucide-react";
import { useBeaconKnowledge, useUploadToBeaconKB } from "@/hooks/useBeaconKnowledge";
import { useBeaconKbOverrides, useUpsertBeaconKbOverride, useClearBeaconKbOverride, useSetBeaconKbTitle, useRecordBeaconKbUpload, useHideBeaconKbFile, KB_HIDDEN_MARKER } from "@/hooks/useBeaconKbOverrides";
import { useUniversalDocuments, useUpdateDocumentTitle } from "@/hooks/useUniversalDocuments";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useAuth } from "@/hooks/useAuth";
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
  const { data: universalDocuments = [] } = useUniversalDocuments();
  const isAdmin = useIsAdmin();
  const updateDocumentTitle = useUpdateDocumentTitle();
  const { data: overrides = [] } = useBeaconKbOverrides();
  const { data: companyProfiles = [] } = useCompanyProfiles();
  const { profile } = useAuth();
  const currentUserName = profile
    ? profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "";
  const setKbTitle = useSetBeaconKbTitle();
  const upsertOverride = useUpsertBeaconKbOverride();
  const clearOverride = useClearBeaconKbOverride();
  const recordUpload = useRecordBeaconKbUpload();
  const hideKbFile = useHideBeaconKbFile();
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
  const [renameTarget, setRenameTarget] = useState<{ id: string | null; filename: string; title: string; folder: string } | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    | "name_asc" | "name_desc"
    | "date_desc" | "date_asc"
    | "uploader_asc" | "uploader_desc"
    | "chunks_desc" | "chunks_asc"
  >("name_asc");

  const toggleSort = (col: "name" | "date" | "uploader" | "chunks") => {
    setSortBy((prev) => {
      if (col === "name") return prev === "name_asc" ? "name_desc" : "name_asc";
      if (col === "date") return prev === "date_desc" ? "date_asc" : "date_desc";
      if (col === "uploader") return prev === "uploader_asc" ? "uploader_desc" : "uploader_asc";
      return prev === "chunks_desc" ? "chunks_asc" : "chunks_desc";
    });
  };
  const sortIndicator = (col: "name" | "date" | "uploader" | "chunks") =>
    sortBy.startsWith(col) ? (sortBy.endsWith("_asc") ? " ↑" : " ↓") : "";

  const documentByFilename = useMemo(() => {
    const map = new Map<string, (typeof universalDocuments)[number]>();
    for (const document of universalDocuments) map.set(document.filename, document);
    return map;
  }, [universalDocuments]);

  // auth user_id -> display name, for "Uploaded by" on Beacon-only files
  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of companyProfiles as any[]) {
      const name = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
      if (p.user_id && name) m.set(p.user_id, name);
    }
    return m;
  }, [companyProfiles]);

  // Build override map: source_file -> { display_folder, hidden_from_original, notes }
  // notes prefixed with "__orig__:<slug>" means a real backend move; the slug is
  // the original Beacon folder so "Reset to original folder" can call the backend
  // to put it back, not just clear a display-only override.
  const overrideMap = useMemo(() => {
    const m = new Map<string, { display_folder: string; display_title: string | null; hidden: boolean; notes: string | null; created_by: string | null; updated_at: string | null; created_at: string | null }>();
    for (const o of overrides) {
      m.set(o.source_file, {
        display_folder: o.display_folder,
        display_title: o.display_title ?? null,
        hidden: o.hidden_from_original,
        notes: o.notes,
        created_by: o.created_by ?? null,
        updated_at: o.updated_at ?? null,
        created_at: o.created_at ?? null,
      });
    }
    return m;
  }, [overrides]);

  // Per-file display metadata used by the Modified / Uploaded by columns and sorting.
  const fileMeta = (filename: string) => {
    const ov = overrideMap.get(filename);
    const doc = documentByFilename.get(filename);
    const beacon = data?.docMeta?.[filename];
    const modified =
      doc?.updated_at || doc?.created_at || ov?.updated_at || ov?.created_at || beacon?.ingested_at || null;
    const uploader = doc?.uploader
      ? (doc.uploader.display_name || [doc.uploader.first_name, doc.uploader.last_name].filter(Boolean).join(" "))
      : (ov?.created_by ? nameByUserId.get(ov.created_by) || null : null);
    return { modified, uploader: uploader || beacon?.uploaded_by || null };
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  const chunkCount = (filename: string) =>
    data?.fileChunks[filename] ?? data?.docMeta?.[filename]?.chunks_created;

  const chunkStatus = (filename: string, count: number | undefined) => {
    if (count === undefined) {
      return { text: "—", title: "Chunk count unavailable", isEmpty: false, isWarning: false };
    }
    if (count === 0) {
      return { text: "0", title: "0 chunks — empty phantom entry, safe to delete", isEmpty: true, isWarning: false };
    }
    const isPdf = filename.toLowerCase().endsWith(".pdf");
    if (count <= 1 && isPdf) {
      return {
        text: String(count),
        title: `Only ${count} chunk${count === 1 ? "" : "s"} for a PDF — possible extraction failure`,
        isEmpty: false,
        isWarning: true,
      };
    }
    return { text: String(count), title: `${count} chunk${count === 1 ? "" : "s"}`, isEmpty: false, isWarning: false };
  };


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
    // (rows marked hidden, e.g. stale/phantom entries left behind after a
    // delete, are dropped entirely and never re-added)
    for (const [source_file, ov] of overrideMap.entries()) {
      const folder = ov.display_folder;
      if (folder === KB_HIDDEN_MARKER || ov.notes === KB_HIDDEN_MARKER) continue;
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
    for (const ov of overrides) {
      if (ov.display_folder === KB_HIDDEN_MARKER) continue;
      set.add(ov.display_folder);
    }
    return Array.from(set).sort();
  }, [apiFolderNames, overrides]);

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !targetFolder) return;
    setUploadProgress({ done: 0, total: selectedFiles.length });
    let successCount = 0;
    let totalChunks = 0;
    for (const file of selectedFiles) {
      try {
        const result = await upload.mutateAsync({
          file,
          folder: targetFolder,
          uploadedBy: currentUserName || undefined,
        });
        totalChunks += result.chunks_created || 0;
        successCount++;
        // Stamp uploader + timestamp so the list can show "Uploaded by" / "Modified".
        try {
          await recordUpload.mutateAsync({ source_file: file.name, display_folder: humanize(targetFolder) });
        } catch { /* metadata stamp is best-effort (requires admin/manager) */ }
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

  // Find which slug the file CURRENTLY lives in on the Beacon backend (before move).
  const findOriginalSlug = (filename: string): string | null => {
    if (!data?.folders) return null;
    for (const [slug, files] of Object.entries(data.folders)) {
      if ((files as string[]).includes(filename)) return slug;
    }
    return null;
  };

  const handleConfirmMove = async () => {
    if (!moveTarget || !moveFolderInput.trim()) return;
    setMoveSaving(true);
    const target = moveFolderInput.trim();
    // Convert humanized folder name back to slug when it matches a known Beacon folder.
    const slugFromHuman = Object.keys(FOLDER_TO_SOURCE_TYPE).find((slug) => humanize(slug) === target);
    const backendFolder = slugFromHuman || target;
    const originalSlug = findOriginalSlug(moveTarget);
    try {
      // 1. Real backend move — in-place, no re-ingest, no duplicates.
      await assignBeaconFolders({ [moveTarget]: backendFolder });
      // 2. Record the move so the UI shows a "moved" badge and "Reset to original
      //    folder" can call the backend to put it back. hidden_from_original=false
      //    because the backend has already removed it from the original slug.
      await upsertOverride.mutateAsync({
        source_file: moveTarget,
        display_folder: target,
        hidden_from_original: false,
        notes: originalSlug ? `__orig__:${originalSlug}` : null,
      });
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

  // Reset a moved file back to its original Beacon folder. For real backend moves
  // (notes prefixed "__orig__:<slug>"), this calls assignBeaconFolders to restore;
  // for display-only overrides it just clears the override row.
  const handleResetToOriginal = async (filename: string) => {
    const ov = overrideMap.get(filename);
    const origSlug = ov?.notes?.startsWith("__orig__:") ? ov.notes.slice("__orig__:".length) : null;
    try {
      if (origSlug) {
        await assignBeaconFolders({ [filename]: origSlug });
      }
      await clearOverride.mutateAsync(filename);
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    }
  };


  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteBeaconDoc(deleteTarget);
      // Beacon's index can keep returning a stale (phantom) entry after the
      // chunks are gone — hide it locally so it stops reappearing in the list.
      await hideKbFile.mutateAsync(deleteTarget).catch(() => {});
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

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameTitle.trim()) return;
    try {
      if (renameTarget.id) {
        await updateDocumentTitle.mutateAsync({ id: renameTarget.id, title: renameTitle });
        toast({ title: "Title updated" });
      } else {
        await setKbTitle.mutateAsync({
          source_file: renameTarget.filename,
          display_title: renameTitle.trim(),
          current_folder: renameTarget.folder,
          hidden_from_original: overrideMap.get(renameTarget.filename)?.hidden ?? false,
        });
      }
      setRenameTarget(null);
      setRenameTitle("");
    } catch (err: any) {
      toast({
        title: /security policy|permission/i.test(err?.message || "") ? "Rename blocked — permission denied" : "Rename failed",
        description: err.message,
        variant: "destructive",
      });

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

      {/* Search / sort / upload */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by name..."
            className="pl-8"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
            <SelectItem value="date_desc">Newest modified</SelectItem>
            <SelectItem value="date_asc">Oldest modified</SelectItem>
            <SelectItem value="uploader_asc">Uploaded by A–Z</SelectItem>
            <SelectItem value="uploader_desc">Uploaded by Z–A</SelectItem>
            <SelectItem value="chunks_desc">Most chunks</SelectItem>
            <SelectItem value="chunks_asc">Fewest chunks</SelectItem>
          </SelectContent>
        </Select>
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
                const q = search.trim().toLowerCase();
                const files = Array.from(effectiveFolders.get(folderName) || [])
                  .filter((filename) => {
                    if (!q) return true;
                    const ov = overrideMap.get(filename);
                    const title = documentByFilename.get(filename)?.title || ov?.display_title || filename;
                    return filename.toLowerCase().includes(q) || title.toLowerCase().includes(q);
                  })
                  .sort((a, b) => {
                    if (sortBy === "name_asc" || sortBy === "name_desc") {
                      const ta = documentByFilename.get(a)?.title || overrideMap.get(a)?.display_title || a;
                      const tb = documentByFilename.get(b)?.title || overrideMap.get(b)?.display_title || b;
                      const cmp = ta.trim().localeCompare(tb.trim(), undefined, { sensitivity: "base" });
                      return sortBy === "name_asc" ? cmp : -cmp;
                    }
                    if (sortBy === "uploader_asc" || sortBy === "uploader_desc") {
                      const ua = fileMeta(a).uploader || "";
                      const ub = fileMeta(b).uploader || "";
                      if (!ua && ub) return 1;
                      if (ua && !ub) return -1;
                      const cmp = ua.localeCompare(ub, undefined, { sensitivity: "base" });
                      return sortBy === "uploader_asc" ? cmp : -cmp;
                    }
                    if (sortBy === "chunks_desc" || sortBy === "chunks_asc") {
                      const ca = chunkCount(a) ?? -1;
                      const cb = chunkCount(b) ?? -1;
                      return sortBy === "chunks_desc" ? cb - ca : ca - cb;
                    }
                    const da = fileMeta(a).modified ? new Date(fileMeta(a).modified!).getTime() : 0;
                    const db = fileMeta(b).modified ? new Date(fileMeta(b).modified!).getTime() : 0;
                    return sortBy === "date_desc" ? db - da : da - db;
                  });
                if (q && files.length === 0) return null;
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
                      <div className="grid gap-1 pl-6 min-w-0">
                        <div className="flex items-center gap-2 px-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground min-w-0">
                          <button type="button" onClick={() => toggleSort("name")} className="flex-1 min-w-0 text-left uppercase hover:text-foreground transition-colors">Name{sortIndicator("name")}</button>
                          <button type="button" onClick={() => toggleSort("date")} className="hidden md:block w-28 shrink-0 text-left uppercase hover:text-foreground transition-colors">Modified{sortIndicator("date")}</button>
                          <button type="button" onClick={() => toggleSort("uploader")} className="hidden lg:block w-36 shrink-0 text-left uppercase hover:text-foreground transition-colors">Uploaded by{sortIndicator("uploader")}</button>
                          <button type="button" onClick={() => toggleSort("chunks")} className="w-20 shrink-0 text-right uppercase hover:text-foreground transition-colors">Chunks{sortIndicator("chunks")}</button>
                          <span className="w-7 shrink-0" />
                        </div>
                        {files.map((filename) => {
                          const ov = overrideMap.get(filename);
                          const universalDocument = documentByFilename.get(filename);
                          const displayTitle = universalDocument?.title || ov?.display_title || filename;
                          const meta = fileMeta(filename);
                          return (
                            <div
                              key={filename}
                              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm group min-w-0"
                            >
                              <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <button
                                type="button"
                                className="truncate flex-1 min-w-0 text-left cursor-pointer"
                                onClick={() => setViewingFile(filename)}
                                title={filename}
                              >
                                {displayTitle}
                              </button>

                              {ov?.hidden && (
                                <Badge variant="outline" className="text-[10px] opacity-70">moved</Badge>
                              )}
                              <span className="hidden md:block w-28 shrink-0 text-xs text-muted-foreground truncate">
                                {formatDate(meta.modified)}
                              </span>
                              <span className="hidden lg:block w-36 shrink-0 text-xs text-muted-foreground truncate" title={meta.uploader || undefined}>
                                {meta.uploader || "—"}
                              </span>
                              {(() => {
                                const count = chunkCount(filename);
                                const status = chunkStatus(filename, count);
                                return (
                                  <span
                                    className={`block w-20 shrink-0 text-xs text-right ${
                                      status.isEmpty ? "text-muted-foreground italic" : status.isWarning ? "text-destructive" : ""
                                    }`}
                                    title={status.title}
                                  >
                                    {status.isWarning && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                                    {status.text}
                                  </span>
                                );
                              })()}

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
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setRenameTarget({
                                          id: universalDocument?.id ?? null,
                                          filename,
                                          title: displayTitle,
                                          folder: folderName,
                                        });
                                        setRenameTitle(displayTitle);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5 mr-2" /> Rename…
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setMoveTarget(filename);
                                      setMoveFolderInput(ov?.display_folder || "");
                                    }}
                                  >
                                    <FolderInput className="h-3.5 w-3.5 mr-2" /> Move to folder…
                                  </DropdownMenuItem>
                                  {ov && ov.notes !== "__uploaded__" && (
                                    <DropdownMenuItem
                                      onClick={() => handleResetToOriginal(filename)}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset to original folder
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await hideKbFile.mutateAsync(filename);
                                      toast({ title: "Hidden", description: "Stale entry removed from this list." });
                                    }}
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Hide stale entry
                                  </DropdownMenuItem>
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

      {/* Rename dialog — updates the display title only, never the Beacon filename. */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>
              Changes the displayed title. The underlying file name and Beacon index stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kb-document-title">Title</Label>
            <Input
              id="kb-document-title"
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleConfirmRename();
                if (event.key === "Escape") setRenameTarget(null);
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">File name: {renameTarget?.filename}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!renameTitle.trim() || updateDocumentTitle.isPending || setKbTitle.isPending}
            >
              {(updateDocumentTitle.isPending || setKbTitle.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
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
              Reassigns this file to a new folder on the Beacon backend — in-place, no re-ingest,
              no duplicate chunks. Beacon search results update immediately.
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
            <Button onClick={handleConfirmMove} disabled={!moveFolderInput.trim() || moveSaving}>
              {moveSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderInput className="h-4 w-4 mr-2" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete from Beacon knowledge base?</DialogTitle>
            <DialogDescription className="text-xs">
              Removes this file's chunks from Beacon search. The original is backed up and
              restorable from <strong>Recently Deleted</strong> below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">File</Label>
            <p className="text-sm font-medium break-all">{deleteTarget}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteSaving}>
              {deleteSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
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
