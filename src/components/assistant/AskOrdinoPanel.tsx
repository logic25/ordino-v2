import { useState, useRef, useEffect } from "react";
import { X, Trash2, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onAsk: (question: string) => void;
  onClear: () => void;
}

const quickPrompts = [
  "Any proposals to follow up on?",
  "What's overdue this week?",
  "Show me open tasks",
  "What invoices are outstanding?",
  "What meetings do I have this week?",
];

function getPageContext(pathname: string): string | null {
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/);
  if (projectMatch) return `Regarding the project I'm currently viewing (ID: ${projectMatch[1]}): `;
  const clientMatch = pathname.match(/^\/clients\/([a-f0-9-]+)/);
  if (clientMatch) return `Regarding the client I'm currently viewing (ID: ${clientMatch[1]}): `;
  return null;
}

export function AskOrdinoPanel({ isOpen, onClose, messages, isLoading, onAsk, onClear }: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const prefix = getPageContext(location.pathname);
    onAsk(prefix ? prefix + text : text);
    setInput("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[400px] max-w-full z-50 flex flex-col bg-card border-l shadow-lg animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Ask Ordino</span>
          <kbd className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground ml-1">
            ⌘K
          </kbd>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear} title="Clear conversation">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="space-y-4 pt-8">
            <div className="text-center">
              <Sparkles className="h-8 w-8 mx-auto text-accent/60 mb-2" />
              <p className="text-sm font-medium">How can I help?</p>
              <p className="text-xs text-muted-foreground mt-1">Ask about projects, proposals, invoices, or anything in Ordino.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onAsk(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted transition-colors text-foreground/80"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-accent [&_a]:underline [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-3 py-3 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!input.trim() || isLoading}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
