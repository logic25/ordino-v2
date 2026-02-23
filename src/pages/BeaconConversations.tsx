import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mockConversations, type BeaconConversation, type ConfidenceLevel } from "@/lib/beaconMockData";
import { Search, MessageSquare, AlertTriangle, CheckCircle, XCircle, FileText, Building2, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const confidenceColors: Record<ConfidenceLevel, string> = { high: "bg-[#22c55e]", medium: "bg-yellow-500", low: "bg-destructive" };
const confidenceLabels: Record<ConfidenceLevel, string> = { high: "High Confidence", medium: "Medium", low: "Low — Verify" };

export default function BeaconConversations() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [cardTypeFilter, setCardTypeFilter] = useState("all");
  const [selected, setSelected] = useState<BeaconConversation | null>(null);
  const [correction, setCorrection] = useState("");

  const filtered = useMemo(() => {
    return mockConversations.filter(c => {
      if (confidenceFilter !== "all" && c.confidence !== confidenceFilter) return false;
      if (cardTypeFilter !== "all" && c.card_type !== cardTypeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.question.toLowerCase().includes(q) && !c.response.toLowerCase().includes(q) && !c.user.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, confidenceFilter, cardTypeFilter]);

  const isHallucination = (c: BeaconConversation) => c.confidence === "low" && c.rag_sources.length === 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-6 w-6 text-[#22c55e]" />
            <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
          </div>
          <p className="text-muted-foreground">Searchable archive of all Beacon interactions across spaces and DMs</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search questions, responses, users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Confidence" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="property_lookup">Property Lookup</SelectItem>
              <SelectItem value="filing_question">Filing Question</SelectItem>
              <SelectItem value="code_question">Code Question</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {filtered.map(conv => (
            <Card key={conv.id} className="cursor-pointer hover:ring-1 hover:ring-[#22c55e]/30 transition-all" onClick={() => setSelected(conv)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">{conv.user}</span>
                      <Badge variant="outline" className="text-[10px]">{conv.space}</Badge>
                      <Badge className={`text-[10px] text-white ${confidenceColors[conv.confidence]}`}>{confidenceLabels[conv.confidence]}</Badge>
                      {isHallucination(conv) && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-0.5" /> Possible Hallucination</Badge>}
                    </div>
                    <p className="text-sm truncate">{conv.question}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(conv.timestamp).toLocaleString()}</span>
                      <span>{conv.rag_sources.length} source(s)</span>
                      <Badge variant="secondary" className="text-[10px]">{conv.card_type.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Sheet */}
        <Sheet open={!!selected} onOpenChange={() => { setSelected(null); setCorrection(""); }}>
          <SheetContent className="sm:max-w-2xl overflow-y-auto">
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#22c55e]" />
                    Conversation Detail
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{selected.user}</span>
                    <Badge variant="outline">{selected.space}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(selected.timestamp).toLocaleString()}</span>
                  </div>

                  {/* Question */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                      <p className="text-sm">{selected.question}</p>
                    </CardContent>
                  </Card>

                  {/* Enriched Card Preview */}
                  <Card className="border-[#22c55e]/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold">B</span>
                          </div>
                          <span className="text-sm font-medium">Beacon</span>
                        </div>
                        <Badge className={`text-[10px] text-white ${confidenceColors[selected.confidence]}`}>{confidenceLabels[selected.confidence]}</Badge>
                      </div>

                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{selected.response}</ReactMarkdown>
                      </div>

                      {/* Sources */}
                      {selected.rag_sources.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium mb-2">📄 Sources</p>
                          {selected.rag_sources.map((s, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1">
                              <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {s.file}</span>
                              <span className="font-mono text-[#22c55e]">{Math.round(s.relevance * 100)}% match</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Card type indicators */}
                      {selected.card_type === "property_lookup" && (
                        <div className="border-t pt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-4 w-4" /> Property Data Card
                        </div>
                      )}
                      {selected.card_type === "filing_question" && (
                        <div className="border-t pt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <ListChecks className="h-4 w-4" /> Filing Checklist Card
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="border-t pt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); toast({ title: "Marked as Correct" }); }}>
                          <CheckCircle className="h-3 w-3 mr-1 text-[#22c55e]" /> Correct
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={(e) => e.stopPropagation()}>
                          <XCircle className="h-3 w-3 mr-1 text-destructive" /> Wrong
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Correction */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Submit Correction</p>
                    <Textarea placeholder="Describe what was wrong and the correct answer..." value={correction} onChange={(e) => setCorrection(e.target.value)} rows={3} />
                    <Button size="sm" disabled={!correction.trim()} onClick={() => { toast({ title: "Correction Submitted" }); setCorrection(""); setSelected(null); }}>
                      Submit Correction
                    </Button>
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
