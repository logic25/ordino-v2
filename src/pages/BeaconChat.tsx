import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockConversations, type ConfidenceLevel } from "@/lib/beaconMockData";
import { Send, Brain, User, FileText, ChevronRight, ChevronLeft, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";

const quickQuestions = [
  "What's the difference between Alt-1 and Alt-2?",
  "Look up 927 Broadway",
  "How do I file an NB in DOB NOW?",
  "What BB applies to energy code?",
  "Can I file a PAA on a professionally certified job?",
];

interface ChatMessage {
  role: "user" | "beacon";
  text: string;
  confidence?: ConfidenceLevel;
  sources?: { file: string; relevance: number }[];
  responseTime?: string;
}

const confidenceColors: Record<ConfidenceLevel, string> = { high: "bg-[#22c55e]", medium: "bg-yellow-500", low: "bg-destructive" };

export default function BeaconChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const findMockResponse = (q: string) => {
    const lq = q.toLowerCase();
    return mockConversations.find(c => c.question.toLowerCase().includes(lq.slice(0, 20))) || mockConversations[0];
  };

  const handleSend = (text?: string) => {
    const q = text || input.trim();
    if (!q) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);
    setTimeout(() => {
      const mock = findMockResponse(q);
      setMessages(prev => [...prev, {
        role: "beacon",
        text: mock.response,
        confidence: mock.confidence,
        sources: mock.rag_sources,
        responseTime: `${(Math.random() * 1.5 + 0.5).toFixed(1)}s`,
      }]);
      setLoading(false);
    }, 800 + Math.random() * 1200);
  };

  const debugMsg = selectedMsg !== null ? messages[selectedMsg] : messages.filter(m => m.role === "beacon").at(-1);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] animate-fade-in">
        {/* Main Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-[#22c55e]" />
              <h1 className="font-semibold">Beacon Chat — Test Interface</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)}>
              {showDebug ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span className="ml-1 text-xs">Debug</span>
            </Button>
          </div>

          {/* Quick Questions */}
          {messages.length === 0 && (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Quick test questions:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, i) => (
                  <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => handleSend(q)}>
                    <Zap className="h-3 w-3 mr-1" /> {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "beacon" && (
                  <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2" : ""}`}>
                  {msg.role === "beacon" ? (
                    <Card className={`cursor-pointer ${selectedMsg === i ? "ring-1 ring-[#22c55e]" : ""}`} onClick={() => setSelectedMsg(i)}>
                      <CardContent className="p-3 space-y-2">
                        <div className="prose prose-sm max-w-none"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {msg.confidence && <Badge className={`text-[10px] text-white ${confidenceColors[msg.confidence]}`}>{msg.confidence}</Badge>}
                          {msg.sources && <span className="text-[10px] text-muted-foreground">{msg.sources.length} source(s)</span>}
                          {msg.responseTime && <span className="text-[10px] text-muted-foreground">{msg.responseTime}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-sm">{msg.text}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0">
                  <Brain className="h-4 w-4 text-white animate-pulse" />
                </div>
                <Card><CardContent className="p-3"><span className="text-sm text-muted-foreground">Thinking...</span></CardContent></Card>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Beacon a question..." className="flex-1" disabled={loading} />
              <Button type="submit" disabled={!input.trim() || loading} className="bg-[#22c55e] hover:bg-[#16a34a] text-white">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="w-80 border-l bg-muted/30 overflow-y-auto p-4 space-y-4 hidden lg:block">
            <h2 className="text-sm font-semibold">RAG Debug Panel</h2>
            {debugMsg && debugMsg.role === "beacon" ? (
              <>
                <div>
                  <p className="text-xs font-medium mb-1">Confidence</p>
                  <Badge className={`text-white ${confidenceColors[debugMsg.confidence!]}`}>{debugMsg.confidence}</Badge>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Matched Sources</p>
                  {debugMsg.sources?.length ? debugMsg.sources.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                      <span className="flex items-center gap-1 truncate"><FileText className="h-3 w-3 shrink-0" /> {s.file}</span>
                      <span className="font-mono text-[#22c55e] shrink-0">{Math.round(s.relevance * 100)}%</span>
                    </div>
                  )) : <p className="text-xs text-muted-foreground">No RAG sources matched</p>}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Flow Type</p>
                  <Badge variant="outline" className="text-[10px]">{debugMsg.sources?.length ? "RAG + LLM" : "Direct / Cached"}</Badge>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Cache Hit</p>
                  <span className="text-xs text-muted-foreground">No</span>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Response Time</p>
                  <span className="text-xs">{debugMsg.responseTime}</span>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Model</p>
                  <span className="text-xs">Claude 3 Haiku</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Send a message to see debug info</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
