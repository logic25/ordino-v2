import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { mockContentCandidates, type ContentCandidate, type ContentStatus } from "@/lib/beaconMockData";
import { Sparkles, Zap, FileEdit, CheckCircle, ArrowRight, Search as SearchIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const statusTabs: { value: ContentStatus; label: string; icon: React.ReactNode }[] = [
  { value: "incoming", label: "Incoming", icon: <ArrowRight className="h-4 w-4" /> },
  { value: "scored", label: "Scored", icon: <Zap className="h-4 w-4" /> },
  { value: "draft", label: "Drafts", icon: <FileEdit className="h-4 w-4" /> },
  { value: "published", label: "Published", icon: <CheckCircle className="h-4 w-4" /> },
];

const typeColors: Record<string, string> = { blog: "bg-blue-500", newsletter: "bg-purple-500", internal: "bg-orange-500" };

export default function BeaconContentEngine() {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("draft");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");

  const filteredItems = useMemo(() =>
    mockContentCandidates.filter(c => c.status === tab),
  [tab]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-6 w-6 text-[#22c55e]" />
              <h1 className="text-3xl font-bold tracking-tight">Content Engine</h1>
            </div>
            <p className="text-muted-foreground">Monitor DOB updates and generate content from team question patterns</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Analyzing Opportunities", description: "Scanning team questions for content gaps..." })}>
              <SearchIcon className="h-4 w-4 mr-1" /> Analyze Opportunities
            </Button>
            <Button size="sm" className="bg-[#22c55e] hover:bg-[#16a34a] text-white" onClick={() => toast({ title: "Auto-Generate", description: "Analyzing recent questions... 3 candidates generated" })}>
              <Sparkles className="h-4 w-4 mr-1" /> Auto-Generate
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {statusTabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.icon} {t.label}
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                  {mockContentCandidates.filter(c => c.status === t.value).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {statusTabs.map(t => (
            <TabsContent key={t.value} value={t.value} className="space-y-4 mt-4">
              {mockContentCandidates.filter(c => c.status === t.value).length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No items in this stage</CardContent></Card>
              ) : (
                mockContentCandidates.filter(c => c.status === t.value).map(item => (
                  <Card key={item.id} className="hover:ring-1 hover:ring-[#22c55e]/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-medium text-sm">{item.title}</h3>
                            <Badge className={`text-[10px] text-white ${typeColors[item.content_type]}`}>{item.content_type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Source: {item.source}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                              <span className="text-xs text-muted-foreground">Relevance</span>
                              <Progress value={item.relevance_score} className="h-2 flex-1" />
                              <span className="text-xs font-mono">{item.relevance_score}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{item.related_questions_count} related questions</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setExpandedId(expandedId === item.id ? null : item.id); setEditDraft(item.draft_content); }}>
                          {expandedId === item.id ? "Collapse" : "Expand"}
                        </Button>
                      </div>

                      {expandedId === item.id && item.draft_content && (
                        <div className="mt-4 space-y-3 border-t pt-4">
                          <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={12} className="font-mono text-xs" />
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-[#22c55e] hover:bg-[#16a34a] text-white" onClick={() => toast({ title: "Approved", description: `"${item.title}" moved to Published.` })}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => toast({ title: "Rejected" })}>Reject</Button>
                            <Button size="sm" variant="outline" onClick={() => toast({ title: "Draft Saved" })}>Save Draft</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
