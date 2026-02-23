import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type ConfidenceLevel = "high" | "medium" | "low";

const mockResponses = [
  { question: "alt", response: "**Alt-1** covers minor alterations (single work type, no change of use/egress). **Alt-2** covers multiple work types or changes to egress/use/occupancy. If your scope touches two or more systems, it's likely an Alt-2.", confidence: "high" as ConfidenceLevel, rag_sources: [{ file: "alt1_filing_guide.md", relevance: 0.92 }, { file: "alt2_filing_guide.md", relevance: 0.89 }] },
  { question: "nb", response: "To file a New Building (NB) in DOB NOW:\n1. Log into DOB NOW Build\n2. Select 'New Building'\n3. Enter property info (BIN, Block, Lot)\n4. Upload plans and required documents\n5. Pay filing fees\n6. Submit for plan examination", confidence: "high" as ConfidenceLevel, rag_sources: [{ file: "nb_filing_guide.md", relevance: 0.95 }] },
  { question: "energy", response: "Per **BB 2026-005**, the 2025 NYC Energy Conservation Code applies to all applications filed on or after its effective date. Jobs filed under the 2020 code remain under that code unless amended.", confidence: "high" as ConfidenceLevel, rag_sources: [{ file: "energy_code_compliance_guide.md", relevance: 0.88 }, { file: "bb_2026_005_energy_code_applicability.md", relevance: 0.85 }] },
  { question: "look up", response: "**927 Broadway, Manhattan**\n- **BIN:** 1015477\n- **Block/Lot:** 00830/0030\n- **Zoning:** M1-5/R10\n- **Landmark:** No\n- **Active Permits:** 3\n- **Open Violations:** 1 (ECB)", confidence: "high" as ConfidenceLevel, rag_sources: [] },
  { question: "sidewalk", response: "I don't have detailed documentation on the sidewalk shed renewal process. This may be a knowledge gap — consider adding content to the knowledge base.", confidence: "low" as ConfidenceLevel, rag_sources: [] },
  { question: "paa", response: "Yes, you can file a PAA on a professionally certified job. The PAA follows the same professional certification pathway as the original filing. See BB 2025-005 for current requirements.", confidence: "high" as ConfidenceLevel, rag_sources: [{ file: "paa_post_approval_amendment_guide.md", relevance: 0.91 }, { file: "bb_2025_005_professional_certification.md", relevance: 0.86 }] },
  { question: "1968", response: "Code applicability depends on the filing date. Per **BB 2022-007**, buildings constructed under the 1968 code may file under 1968, 2014, or 2022 code depending on when the application is submitted.", confidence: "high" as ConfidenceLevel, rag_sources: [{ file: "bb_2022_007_code_applicability.md", relevance: 0.93 }, { file: "bc_1968_subchapter6_egress.md", relevance: 0.78 }] },
  { question: "fire escape", response: "Fire escapes may be acceptable for egress in existing MDL buildings under certain conditions. MDL §53 governs fire escape requirements. However, new construction must comply with current egress standards.", confidence: "medium" as ConfidenceLevel, rag_sources: [{ file: "mdl_53_fire_escapes.md", relevance: 0.90 }, { file: "rcny_1_15_fire_escapes.md", relevance: 0.82 }, { file: "egress_requirements_guide.md", relevance: 0.75 }] },
];
import { Send, Brain, User, FileText, Zap, X, Minus, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useUserRoles";

const quickQuestions = [
  "Alt-1 vs Alt-2?",
  "How to file NB?",
  "Look up address",
  "Energy code?",
];

interface ChatMessage {
  role: "user" | "beacon";
  text: string;
  confidence?: ConfidenceLevel;
  sources?: { file: string; relevance: number }[];
  responseTime?: string;
}

const confidenceColors: Record<ConfidenceLevel, string> = {
  high: "bg-[#22c55e]",
  medium: "bg-yellow-500",
  low: "bg-destructive",
};

export function BeaconChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const findMockResponse = (q: string) => {
    const lq = q.toLowerCase();
    return mockResponses.find((c) => lq.includes(c.question)) || mockResponses[0];
  };

  const handleSend = (text?: string) => {
    const q = text || input.trim();
    if (!q) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);
    setTimeout(() => {
      const mock = findMockResponse(q);
      setMessages((prev) => [
        ...prev,
        {
          role: "beacon",
          text: mock.response,
          confidence: mock.confidence,
          sources: mock.rag_sources,
          responseTime: `${(Math.random() * 1.5 + 0.5).toFixed(1)}s`,
        },
      ]);
      setLoading(false);
    }, 800 + Math.random() * 1200);
  };

  const lastBeaconMsg = messages.filter((m) => m.role === "beacon").at(-1);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
        title="Ask Beacon"
      >
        <Brain className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-[#22c55e] text-white">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <span className="font-semibold text-sm">Beacon</span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => setShowDebug(!showDebug)}
              title="Toggle RAG debug"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Brain className="h-8 w-8 mx-auto text-[#22c55e]/40 mb-2" />
            <p className="text-xs text-muted-foreground mb-3">Ask Beacon anything about NYC construction & expediting</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
                >
                  <Zap className="h-3 w-3 inline mr-0.5" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "")}>
            {msg.role === "beacon" && (
              <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0 mt-1">
                <Brain className="h-3 w-3 text-white" />
              </div>
            )}
            <div className={cn("max-w-[85%]", msg.role === "user" ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2" : "")}>
              {msg.role === "beacon" ? (
                <div className="space-y-1.5">
                  <div className="prose prose-sm max-w-none text-xs">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {msg.confidence && (
                      <Badge className={cn("text-[9px] text-white px-1.5 py-0", confidenceColors[msg.confidence])}>
                        {msg.confidence}
                      </Badge>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <span className="text-[9px] text-muted-foreground">{msg.sources.length} source(s)</span>
                    )}
                    {msg.responseTime && (
                      <span className="text-[9px] text-muted-foreground">{msg.responseTime}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0">
              <Brain className="h-3 w-3 text-white animate-pulse" />
            </div>
            <span className="text-xs text-muted-foreground mt-1.5">Thinking...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Debug panel (collapsible) */}
      {showDebug && lastBeaconMsg && (
        <div className="border-t bg-muted/30 px-3 py-2 max-h-32 overflow-y-auto">
          <p className="text-[10px] font-semibold mb-1">RAG Debug</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground">Confidence:</span>
              <Badge className={cn("text-[9px] text-white px-1 py-0", confidenceColors[lastBeaconMsg.confidence!])}>{lastBeaconMsg.confidence}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground">Flow:</span>
              <span>{lastBeaconMsg.sources?.length ? "RAG + LLM" : "Direct"}</span>
            </div>
            {lastBeaconMsg.sources?.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="truncate flex items-center gap-1"><FileText className="h-2.5 w-2.5" />{s.file}</span>
                <span className="font-mono text-[#22c55e] shrink-0">{Math.round(s.relevance * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Beacon..."
            className="flex-1 h-9 text-sm"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            size="icon"
            className="h-9 w-9 bg-[#22c55e] hover:bg-[#16a34a] text-white shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
