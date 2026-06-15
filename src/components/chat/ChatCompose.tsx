import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, CornerDownRight, X } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  isSending: boolean;
  placeholder?: string;
  /** When set, a banner shows above the composer indicating the reply target. */
  replyingTo?: { preview: string; senderName?: string } | null;
  onCancelReply?: () => void;
}

export function ChatCompose({ onSend, isSending, placeholder = "Type a message...", replyingTo, onCancelReply }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyingTo && onCancelReply) {
      e.preventDefault();
      onCancelReply();
    }
  };

  return (
    <div className="border-t">
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-xs">
          <CornerDownRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-muted-foreground shrink-0">Replying in thread</span>
          {replyingTo.senderName && (
            <span className="font-medium text-foreground shrink-0">· {replyingTo.senderName}</span>
          )}
          <span className="truncate text-muted-foreground italic">"{replyingTo.preview}"</span>
          {onCancelReply && (
            <button
              onClick={onCancelReply}
              className="ml-auto shrink-0 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
              aria-label="Cancel reply"
              title="Cancel reply (Esc)"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      )}
      <div className="p-3 flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? "Reply to thread..." : placeholder}
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
          rows={1}
        />
        <Button
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
