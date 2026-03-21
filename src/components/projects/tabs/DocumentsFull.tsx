import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Upload, File, FileText, Eye, Download, Trash2, Loader2,
  ExternalLink, ArrowUpDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { docCategoryLabels } from "@/components/projects/projectMockData";
import type { MockDocument } from "@/components/projects/projectMockData";

export function DocumentsFull({ documents, projectId, companyId, proposal }: { documents: MockDocument[]; projectId?: string; companyId?: string; proposal?: any }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"type" | "size" | "date" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: "type" | "size" | "date") => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; isPdf?: boolean; isImage?: boolean; isHtml?: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !companyId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("universal-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: uploaderProfile } = await supabase.from("profiles").select("id").single();
      const { error } = await supabase.from("universal_documents").insert({
        company_id: companyId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        category: "general",
        filename: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        tags: [],
        project_id: projectId,
        uploaded_by: uploaderProfile?.id || null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Uploaded", description: `${file.name} uploaded successfully.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDelete = async (doc: MockDocument) => {
    if (!doc.storage_path) return;
    setDeleting(doc.id);
    try {
      const bucket = doc.storageBucket || "universal-documents";
      await supabase.storage.from(bucket).remove([doc.storage_path]);
      if (!doc.id.startsWith("pis-") && !doc.id.startsWith("signed-proposal-")) {
        const { error } = await supabase.from("universal_documents").delete().eq("id", doc.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Deleted", description: `${doc.name} removed.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async (doc: MockDocument) => {
    try {
      const bucket = doc.storageBucket || "universal-documents";
      const { data, error } = await supabase.storage.from(bucket).download(doc.storage_path || "");
      if (error || !data) {
        toast({ title: "Error", description: "Failed to load document preview.", variant: "destructive" });
        return;
      }
      const ext = (doc.filename || doc.name).split(".").pop()?.toLowerCase();
      const isPdf = ext === "pdf";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "");
      const isHtml = ext === "html" || ext === "htm";
      const blobUrl = URL.createObjectURL(data);
      setPreviewDoc({ url: blobUrl, name: doc.filename || doc.name, isPdf, isImage, isHtml });
    } catch {
      toast({ title: "Error", description: "Failed to load document.", variant: "destructive" });
    }
  };

  const handleDownload = async (doc: MockDocument) => {
    try {
      const bucket = doc.storageBucket || "universal-documents";
      const { data, error } = await supabase.storage.from(bucket).download(doc.storage_path || "");
      if (error || !data) {
        toast({ title: "Download failed", variant: "destructive" });
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename || doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download document.", variant: "destructive" });
    }
  };

  const parseSizeBytes = (s: string): number => {
    if (!s || s === "—") return 0;
    const match = s.match(/([\d.]+)\s*(KB|MB|GB|B)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === "GB") return val * 1e9;
    if (unit === "MB") return val * 1e6;
    if (unit === "KB") return val * 1e3;
    return val;
  };

  const parseDocDate = (d: string): number => {
    if (!d || d === "—") return 0;
    return new Date(d).getTime() || 0;
  };

  const filtered = documents.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || d.category === catFilter;
    return matchSearch && matchCat;
  }).sort((a, b) => {
    if (!sortKey) return 0;
    let cmp = 0;
    if (sortKey === "type") {
      const extA = (a.filename || a.name).split(".").pop()?.toLowerCase() || "";
      const extB = (b.filename || b.name).split(".").pop()?.toLowerCase() || "";
      cmp = extA.localeCompare(extB);
    } else if (sortKey === "size") {
      cmp = parseSizeBytes(a.size) - parseSizeBytes(b.size);
    } else if (sortKey === "date") {
      cmp = parseDocDate(a.uploadedDate) - parseDocDate(b.uploadedDate);
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search documents..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(docCategoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <input type="file" className="hidden" id="doc-upload-input" onChange={handleUpload} />
          <Button size="sm" className="gap-1.5" disabled={uploading} onClick={() => document.getElementById("doc-upload-input")?.click()}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <File className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No documents found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("type")}>
                  Type <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("size")}>
                  Size <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("date")}>
                  Date <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{docCategoryLabels[doc.category] || doc.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono uppercase">
                  {(doc.filename || doc.name).split(".").pop() || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm tabular-nums">{doc.size}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{doc.uploadedBy}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{doc.uploadedDate}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => handlePreview(doc)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {!doc.id.startsWith("signed-proposal-") && doc.category !== "contract" && doc.category !== "change_order" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => handleDelete(doc)}
                        disabled={deleting === doc.id}
                      >
                        {deleting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(open) => {
        if (!open) {
          if (previewDoc?.url) URL.revokeObjectURL(previewDoc.url);
          setPreviewDoc(null);
        }
      }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-base">{previewDoc?.name}</DialogTitle>
            <DialogDescription className="sr-only">Document preview</DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="px-4 pb-4" style={{ height: "75vh" }}>
              {previewDoc.isImage ? (
                <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full max-h-full mx-auto rounded-md border object-contain" />
              ) : previewDoc.isPdf ? (
                <object data={previewDoc.url} type="application/pdf" className="w-full h-full rounded-md border">
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <p>PDF preview not supported in this browser context.</p>
                    <Button variant="outline" size="sm" onClick={() => window.open(previewDoc.url, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in New Tab
                    </Button>
                  </div>
                </object>
              ) : (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-full rounded-md border"
                  title={previewDoc.name}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
