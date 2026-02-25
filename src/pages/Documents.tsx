import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Upload, Search, Download, Trash2, Loader2, File, FileImage,
  FileSpreadsheet, FolderPlus, Eye, Brain, RefreshCw, ChevronRight,
} from "lucide-react";
import { useUniversalDocuments, useUploadDocument, useDeleteDocument, type UniversalDocument } from "@/hooks/useUniversalDocuments";
import { useDocumentFolders, useSeedFolders, useCreateFolder, useDeleteFolder, useRenameFolder, type DocumentFolder } from "@/hooks/useDocumentFolders";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { format } from "date-fns";
import { FolderTree } from "@/components/documents/FolderTree";
import { DocumentPreviewSheet } from "@/components/documents/DocumentPreviewSheet";
import { NewFolderDialog } from "@/components/documents/NewFolderDialog";
import { syncDocumentToBeacon } from "@/services/beaconApi";
import { useQueryClient } from "@tanstack/react-query";
import { KnowledgeBaseView } from "@/components/documents/KnowledgeBaseView";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "lease", label: "Lease / Agreement" },
  { value: "insurance", label: "Insurance" },
  { value: "license", label: "License / Certification" },
  { value: "contract", label: "Contract" },
  { value: "legal", label: "Legal" },
  { value: "financial", label: "Financial" },
  { value: "template", label: "Template" },
  { value: "other", label: "Other" },
];

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return FileSpreadsheet;
  return FileText;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function BeaconStatusBadge({ doc }: { doc: any }) {
  const status = doc.beacon_status;
  if (!status) return <Badge variant="outline" className="text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block mr-1" />Not synced</Badge>;
  if (status === "pending") return <Badge className="bg-[#f59e0b] text-white text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block mr-1 animate-pulse" />Pending</Badge>;
  if (status === "synced") return <Badge className="bg-[hsl(var(--chart-2))] text-white text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block mr-1" />Synced ({doc.beacon_chunks || 0})</Badge>;
  return <Badge variant="destructive" className="text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-white inline-block mr-1" />Error</Badge>;
}

export default function Documents() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [searchParams] = useSearchParams();
  const { data: documents = [], isLoading } = useUniversalDocuments();
  const { data: folders = [], isLoading: foldersLoading } = useDocumentFolders();
  const seedFolders = useSeedFolders();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();
  const createFolder = useCreateFolder();
  const delFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderDefaultParent, setNewFolderDefaultParent] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UniversalDocument | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<DocumentFolder | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentFolder | null>(null);
  const [renameName, setRenameName] = useState("");
  const [previewDoc, setPreviewDoc] = useState<UniversalDocument | null>(null);

  // Upload form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed folders on first load
  useEffect(() => {
    if (!foldersLoading && folders.length === 0) {
      seedFolders.mutate();
    }
  }, [foldersLoading, folders.length]);

  // Get all descendant folder IDs for filtering
  const getDescendantIds = (folderId: string): string[] => {
    const children = folders.filter((f) => f.parent_id === folderId);
    return [folderId, ...children.flatMap((c) => getDescendantIds(c.id))];
  };

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const isBeaconFolder = selectedFolder?.is_beacon_synced || false;

  const filteredDocs = useMemo(() => {
    const folderIds = selectedFolderId ? getDescendantIds(selectedFolderId) : null;
    return documents.filter((doc) => {
      const matchSearch = !searchQuery ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === "all" || doc.category === categoryFilter;
      const matchFolder = folderIds === null || folderIds.includes((doc as any).folder_id);
      return matchSearch && matchCategory && matchFolder;
    });
  }, [documents, searchQuery, categoryFilter, selectedFolderId, folders]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!selectedFolderId) return [];
    const trail: DocumentFolder[] = [];
    let current = folders.find((f) => f.id === selectedFolderId);
    while (current) {
      trail.unshift(current);
      current = current.parent_id ? folders.find((f) => f.id === current!.parent_id) : undefined;
    }
    return trail;
  }, [selectedFolderId, folders]);

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) return;
    try {
      await uploadDoc.mutateAsync({
        file: selectedFile,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        folder_id: selectedFolderId || undefined,
      } as any);

      // If uploading to a beacon folder, sync to Beacon
      if (isBeaconFolder && selectedFile) {
        try {
          const result = await syncDocumentToBeacon(selectedFile, selectedFile.name, selectedFolder?.name || "Beacon Knowledge Base");
          // Update doc beacon status - find the latest doc
          const { data: latestDocs } = await supabase
            .from("universal_documents")
            .select("id")
            .eq("filename", selectedFile.name)
            .order("created_at", { ascending: false })
            .limit(1);
          if (latestDocs?.[0]) {
            await supabase.from("universal_documents").update({
              beacon_status: "synced",
              beacon_synced_at: new Date().toISOString(),
              beacon_chunks: result.chunks_created,
            } as any).eq("id", latestDocs[0].id);
          }
          toast({ title: "Uploaded and synced to Beacon" });
        } catch {
          toast({ title: "Uploaded, but Beacon sync failed", variant: "destructive" });
        }
      } else {
        toast({ title: "Document uploaded" });
      }

      resetForm();
      setUploadOpen(false);
      qc.invalidateQueries({ queryKey: ["universal-documents"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc.mutateAsync({ id: deleteTarget.id, storage_path: deleteTarget.storage_path });
      toast({ title: "Document deleted" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    try {
      await delFolder.mutateAsync({ id: deleteFolderTarget.id, parent_id: deleteFolderTarget.parent_id });
      toast({ title: "Folder deleted" });
      if (selectedFolderId === deleteFolderTarget.id) setSelectedFolderId(null);
      setDeleteFolderTarget(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleRenameFolder = async () => {
    if (!renameTarget || !renameName.trim()) return;
    try {
      await renameFolder.mutateAsync({ id: renameTarget.id, name: renameName.trim() });
      toast({ title: "Folder renamed" });
      setRenameTarget(null);
    } catch (err: any) {
      toast({ title: "Rename failed", description: err.message, variant: "destructive" });
    }
  };

  const handleResync = async (doc: UniversalDocument) => {
    try {
      await supabase.from("universal_documents").update({ beacon_status: "pending" } as any).eq("id", doc.id);
      qc.invalidateQueries({ queryKey: ["universal-documents"] });

      const { data, error } = await supabase.storage.from("universal-documents").download(doc.storage_path);
      if (error || !data) throw new Error("Download failed");

      const result = await syncDocumentToBeacon(data, doc.filename, selectedFolder?.name || "Beacon Knowledge Base");
      await supabase.from("universal_documents").update({
        beacon_status: "synced",
        beacon_synced_at: new Date().toISOString(),
        beacon_chunks: result.chunks_created,
      } as any).eq("id", doc.id);
      toast({ title: "Re-synced to Beacon" });
      qc.invalidateQueries({ queryKey: ["universal-documents"] });
    } catch {
      await supabase.from("universal_documents").update({ beacon_status: "error" } as any).eq("id", doc.id);
      toast({ title: "Beacon sync failed", variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["universal-documents"] });
    }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setCategory("general");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Universal Documents</h1>
            <p className="text-muted-foreground mt-1">Company-wide reference documents, guides, and SOPs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" /> New Folder
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload Document
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          {/* Folder sidebar */}
          <div className="w-64 shrink-0">
            <Card>
              <CardContent className="p-3">
                {foldersLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <FolderTree
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={setSelectedFolderId}
                    onRenameFolder={(f) => { setRenameTarget(f); setRenameName(f.name); }}
                    onCreateSubfolder={(parentId) => { setNewFolderDefaultParent(parentId); setNewFolderOpen(true); }}
                    onDeleteFolder={(f) => setDeleteFolderTarget(f)}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Document list */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <button onClick={() => setSelectedFolderId(null)} className="hover:text-foreground transition-colors">Documents</button>
                {breadcrumbs.map((b) => (
                  <span key={b.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    <button
                      onClick={() => setSelectedFolderId(b.id)}
                      className={b.id === selectedFolderId ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
                    >
                      {b.name}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {isBeaconFolder ? (
              <KnowledgeBaseView />
            ) : (
              <>
                {/* Filters */}
                <div className="flex items-center gap-3">
                  <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search documents..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      {selectedFolder?.name || "All Documents"}
                      <span className="text-muted-foreground font-normal text-sm">({filteredDocs.length})</span>
                    </CardTitle>
                    {selectedFolder?.description && (
                      <p className="text-xs text-muted-foreground">{selectedFolder.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : filteredDocs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium">No documents yet</h3>
                        <p className="text-muted-foreground mt-1 mb-4">Upload reference documents, guides, and SOPs</p>
                        <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-2" /> Upload Document</Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="w-[120px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDocs.map((doc) => {
                            const Icon = getFileIcon(doc.mime_type);
                            const uploaderName = doc.uploader?.display_name ||
                              [doc.uploader?.first_name, doc.uploader?.last_name].filter(Boolean).join(" ") || "—";
                            return (
                              <TableRow key={doc.id} className="cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{doc.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{doc.filename}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm tabular-nums">{formatFileSize(doc.size_bytes)}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{uploaderName}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{format(new Date(doc.created_at), "MMM d, yyyy")}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewDoc(doc)} title="Preview">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(doc)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document{selectedFolder ? ` to "${selectedFolder.name}"` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>File</Label>
              <Input ref={fileInputRef} type="file" className="mt-1" onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (file && !title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
              }} />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!selectedFile || !title.trim() || uploadDoc.isPending}>
              {uploadDoc.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={(open) => { setNewFolderOpen(open); if (!open) setNewFolderDefaultParent(null); }}
        folders={folders}
        defaultParentId={newFolderDefaultParent ?? selectedFolderId}
        onSubmit={async (data) => {
          await createFolder.mutateAsync(data);
          toast({ title: "Folder created" });
        }}
      />

      {/* Rename Folder Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Name</Label>
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="mt-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(); if (e.key === "Escape") setRenameTarget(null); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRenameFolder} disabled={!renameName.trim() || renameFolder.isPending}>
              {renameFolder.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deleteTarget?.title}" and its file.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteDoc.isPending}>
              {deleteDoc.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Confirm */}
      <AlertDialog open={!!deleteFolderTarget} onOpenChange={() => setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFolderTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Documents and subfolders inside will be moved to the parent folder.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Sheet */}
      <DocumentPreviewSheet
        document={previewDoc}
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        isBeaconFolder={isBeaconFolder}
        folderName={selectedFolder?.name}
        isAdmin={isAdmin}
      />
    </AppLayout>
  );
}
