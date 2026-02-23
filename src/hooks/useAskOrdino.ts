import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function useAskOrdino() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const ask = useCallback(async (question: string) => {
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ask-ordino", {
        body: { question, conversationHistory: messages },
      });

      if (error) {
        // Check for rate limit / payment errors
        const status = (error as any)?.context?.status;
        if (status === 429) {
          toast({ title: "Rate limited", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (status === 402) {
          toast({ title: "Credits exhausted", description: "AI credits need to be topped up.", variant: "destructive" });
        }
        throw error;
      }

      const assistantMsg: Message = { role: "assistant", content: data.answer };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        role: "assistant",
        content: "Sorry, I had trouble processing that. Try again?",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, isLoading, isOpen, setIsOpen, ask, clear };
}
