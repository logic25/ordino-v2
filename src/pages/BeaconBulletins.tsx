import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mockBulletins, type BuildingsBulletin } from "@/lib/beaconMockData";
import { Search, ScrollText, ArrowRight, AlertTriangle, RefreshCw, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-[#22c55e] text-white",
  SUPERSEDED: "bg-yellow-500 text-white",
  RESCINDED: "bg-destructive text-destructive-foreground",
};

export default function BeaconBulletins() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedBB, setSelectedBB] = useState<BuildingsBulletin | null>(null);

  const categories = useMemo(() => [...new Set(mockBulletins.map(b => b.category))].sort(), []);

  const filtered = useMemo(() => {
    return mockBulletins.filter(b => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      if (search && !b.bb_number.toLowerCase().includes(search.toLowerCase()) && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  }, [search, statusFilter, categoryFilter]);

  const mostReferenced = useMemo(() =>
    [...mockBulletins].filter(b => b.status === "ACTIVE").sort((a, b) => b.reference_count - a.reference_count).slice(0, 6),
  []);

  const needsReingest = useMemo(() =>
    mockBulletins.filter(b => b.status === "ACTIVE" && b.supersedes.length > 0 && !b.in_knowledge_base),
  []);

  const findBB = (num: string) => mockBulletins.find(b => b.bb_number === num);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="h-6 w-6 text-[#22c55e]" />
            <h1 className="text-3xl font-bold tracking-tight">Buildings Bulletins</h1>
          </div>
          <p className="text-muted-foreground">Track DOB Buildings Bulletins and supersession chains</p>
        </div>

        {/* Alerts */}
        {needsReingest.length > 0 && (
          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{needsReingest.length} active BB(s) supersede content in the knowledge base but haven't been ingested</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast({ title: "Re-ingestion queued" })}>
                <RefreshCw className="h-4 w-4 mr-1" /> Fix
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Most Referenced */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Most Referenced for Expediters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mostReferenced.map(bb => (
              <Card key={bb.id} className="cursor-pointer hover:ring-1 hover:ring-[#22c55e]/40" onClick={() => setSelectedBB(bb)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold">BB {bb.bb_number}</span>
                    <Badge className={`text-[10px] ${statusColors[bb.status]}`}>{bb.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{bb.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{bb.reference_count} references</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by BB number or title..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUPERSEDED">Superseded</SelectItem>
              <SelectItem value="RESCINDED">Rescinded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">BB #</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Issue Date</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Applies To</th>
                <th className="text-left p-3 font-medium">In KB</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(bb => (
                <tr key={bb.id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => setSelectedBB(bb)}>
                  <td className="p-3 font-mono font-semibold">{bb.bb_number}</td>
                  <td className="p-3 max-w-[300px] truncate">{bb.title}</td>
                  <td className="p-3 text-muted-foreground">{bb.issue_date}</td>
                  <td className="p-3"><Badge className={`text-[10px] ${statusColors[bb.status]}`}>{bb.status}</Badge></td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{bb.category}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs">{bb.applies_to}</td>
                  <td className="p-3">{bb.in_knowledge_base ? <Database className="h-4 w-4 text-[#22c55e]" /> : <span className="text-muted-foreground text-xs">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Sheet */}
        <Sheet open={!!selectedBB} onOpenChange={() => setSelectedBB(null)}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            {selectedBB && (
              <>
                <SheetHeader>
                  <SheetTitle>BB {selectedBB.bb_number}</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <h2 className="font-medium">{selectedBB.title}</h2>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={statusColors[selectedBB.status]}>{selectedBB.status}</Badge>
                    <Badge variant="outline">{selectedBB.category}</Badge>
                    <Badge variant="outline">{selectedBB.applies_to}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">Issued: {selectedBB.issue_date}</div>

                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium mb-1">Key Takeaway</p>
                      <p className="text-sm">{selectedBB.key_takeaway}</p>
                    </CardContent>
                  </Card>

                  {/* Supersession Chain */}
                  <div>
                    <p className="text-sm font-medium mb-2">Supersession Chain</p>
                    <div className="space-y-2">
                      {selectedBB.superseded_by && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                          <ArrowRight className="h-4 w-4 text-yellow-600" />
                          <span>Superseded by <span className="font-mono font-semibold">BB {selectedBB.superseded_by}</span></span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm p-2 rounded bg-[#22c55e]/10 border border-[#22c55e]/30">
                        <ScrollText className="h-4 w-4 text-[#22c55e]" />
                        <span className="font-mono font-semibold">BB {selectedBB.bb_number}</span>
                        <Badge className={`text-[10px] ${statusColors[selectedBB.status]}`}>{selectedBB.status}</Badge>
                      </div>
                      {selectedBB.supersedes.length > 0 ? (
                        selectedBB.supersedes.map(s => {
                          const ref = findBB(s);
                          return (
                            <div key={s} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50 border ml-6">
                              <ArrowRight className="h-4 w-4 text-muted-foreground rotate-180" />
                              <span>Supersedes <span className="font-mono font-semibold">BB {s}</span></span>
                              {ref && <span className="text-xs text-muted-foreground truncate">— {ref.title}</span>}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground ml-6">No prior bulletins superseded</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedBB.in_knowledge_base ? (
                      <Badge className="bg-[#22c55e]"><Database className="h-3 w-3 mr-1" /> In Knowledge Base</Badge>
                    ) : (
                      <Badge variant="outline">Not in Knowledge Base</Badge>
                    )}
                  </div>
                  <Button onClick={() => { toast({ title: "Re-ingestion queued", description: `BB ${selectedBB.bb_number} queued.` }); setSelectedBB(null); }} className="bg-[#22c55e] hover:bg-[#16a34a] text-white">
                    <RefreshCw className="h-4 w-4 mr-1" /> Re-ingest
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
