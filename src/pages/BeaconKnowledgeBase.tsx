import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mockKnowledgeFiles, KB_CATEGORY_LABELS, type KnowledgeFile, type KBCategory } from "@/lib/beaconMockData";
import { Search, FileText, AlertTriangle, RefreshCw, Grid3X3, List, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

export default function BeaconKnowledgeBase() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return mockKnowledgeFiles.filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.tags.some(t => t.includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [search, categoryFilter, statusFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mockKnowledgeFiles.forEach((f) => { counts[f.category] = (counts[f.category] || 0) + 1; });
    return counts;
  }, []);

  const handleReingest = (ids?: string[]) => {
    const count = ids?.length || filtered.length;
    toast({ title: "Re-ingestion Queued", description: `${count} file(s) queued for re-ingestion into Pinecone.` });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-6 w-6 text-[#22c55e]" />
              <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            </div>
            <p className="text-muted-foreground">{mockKnowledgeFiles.length} files across {Object.keys(categoryCounts).length} categories</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleReingest()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Re-ingest All
            </Button>
            {selected.size > 0 && (
              <Button size="sm" onClick={() => handleReingest(Array.from(selected))} className="bg-[#22c55e] hover:bg-[#16a34a] text-white">
                <RefreshCw className="h-4 w-4 mr-1" /> Re-ingest {selected.size} Selected
              </Button>
            )}
          </div>
        </div>

        {/* Category Summary */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(KB_CATEGORY_LABELS).map(([key, label]) => (
            <Badge key={key} variant={categoryFilter === key ? "default" : "secondary"} className="cursor-pointer" onClick={() => setCategoryFilter(categoryFilter === key ? "all" : key)}>
              {label} ({categoryCounts[key] || 0})
            </Badge>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search files or tags..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("grid")}><Grid3X3 className="h-4 w-4" /></Button>
            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("table")}><List className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Results */}
        <p className="text-sm text-muted-foreground">{filtered.length} files shown</p>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f) => (
              <Card key={f.id} className="cursor-pointer hover:ring-1 hover:ring-[#22c55e]/40 transition-all" onClick={() => setSelectedFile(f)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm leading-tight">{f.title}</h3>
                    {f.has_verify_tags && <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{KB_CATEGORY_LABELS[f.category]}</Badge>
                    <Badge variant={f.status === "active" ? "default" : "destructive"} className={`text-[10px] ${f.status === "active" ? "bg-[#22c55e]" : ""}`}>
                      {f.status === "active" ? "Active" : "Needs Review"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{f.chunk_count} chunks</span>
                    <span>Updated {f.last_updated}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Chunks</th>
                  <th className="text-left p-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => setSelectedFile(f)}>
                    <td className="p-3 flex items-center gap-2">
                      {f.has_verify_tags && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                      {f.title}
                    </td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]">{KB_CATEGORY_LABELS[f.category]}</Badge></td>
                    <td className="p-3"><Badge variant={f.status === "active" ? "default" : "destructive"} className={`text-[10px] ${f.status === "active" ? "bg-[#22c55e]" : ""}`}>{f.status === "active" ? "Active" : "Review"}</Badge></td>
                    <td className="p-3">{f.chunk_count}</td>
                    <td className="p-3 text-muted-foreground">{f.last_updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Sheet */}
        <Sheet open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            {selectedFile && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#22c55e]" />
                    {selectedFile.title}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{KB_CATEGORY_LABELS[selectedFile.category]}</Badge>
                    <Badge variant={selectedFile.status === "active" ? "default" : "destructive"} className={selectedFile.status === "active" ? "bg-[#22c55e]" : ""}>
                      {selectedFile.status === "active" ? "Active" : "Needs Review"}
                    </Badge>
                    {selectedFile.has_verify_tags && <Badge variant="outline" className="border-orange-500 text-orange-500">Contains [VERIFY]</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Chunks:</span> {selectedFile.chunk_count}</div>
                    <div><span className="text-muted-foreground">Updated:</span> {selectedFile.last_updated}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Tags</p>
                    <div className="flex gap-1 flex-wrap">{selectedFile.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Content Preview</p>
                    <div className="prose prose-sm max-w-none bg-muted/50 rounded-lg p-4">
                      <ReactMarkdown>{selectedFile.content_preview}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => { handleReingest([selectedFile.id]); setSelectedFile(null); }} className="bg-[#22c55e] hover:bg-[#16a34a] text-white">
                      <RefreshCw className="h-4 w-4 mr-1" /> Re-ingest
                    </Button>
                    {selectedFile.status === "needs_review" && (
                      <Button variant="outline" onClick={() => { toast({ title: "Marked as Reviewed" }); setSelectedFile(null); }}>
                        Mark as Reviewed
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
