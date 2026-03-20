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
      // Handle /readiness slash command
      if (question.trim().toLowerCase().startsWith("/readiness")) {
        const { data: profile } = await supabase.from("profiles").select("company_id").limit(1).maybeSingle();
        if (!profile?.company_id) throw new Error("No company");

        const { data, error } = await supabase.functions.invoke("beacon-readiness-check", {
          body: { company_id: profile.company_id, action: "generate_followups" },
        });

        if (error) throw error;

        let content = `## 📋 Project Readiness Report\n\n${data.summary}\n\n`;

        const projects = data.projects || [];
        const needsAttention = projects.filter((p: any) => !p.ready && p.checklist_count > 0);
        const readyProjects = projects.filter((p: any) => p.ready);
        const noChecklist = projects.filter((p: any) => p.no_checklist);

        if (readyProjects.length > 0) {
          content += `**✅ Ready for filing (${readyProjects.length}):**\n`;
          readyProjects.forEach((p: any) => {
            content += `- ${p.project_number || "—"} — ${p.address || p.name || "Untitled"}\n`;
          });
          content += "\n";
        }

        if (needsAttention.length > 0) {
          content += `**⚠️ Needs attention (${needsAttention.length}):**\n`;
          needsAttention.forEach((p: any) => {
            content += `- **${p.project_number || "—"}** — ${p.address || p.name || "Untitled"} (${p.missing} missing)\n`;
            (p.stale_items || []).forEach((s: any) => {
              content += `  - 🕐 *${s.label}* — waiting ${s.days_waiting} days (from ${s.from_whom || "unknown"})\n`;
            });
          });
          content += "\n";
        }

        if (noChecklist.length > 0) {
          content += `**📝 No checklist generated (${noChecklist.length}):**\n`;
          noChecklist.slice(0, 5).forEach((p: any) => {
            content += `- ${p.project_number || "—"} — ${p.address || p.name || "Untitled"}\n`;
          });
          if (noChecklist.length > 5) content += `- ...and ${noChecklist.length - 5} more\n`;
          content += "\n";
        }

        if ((data.follow_ups || []).length > 0) {
          content += `**📨 Suggested follow-ups:**\n`;
          data.follow_ups.slice(0, 10).forEach((f: any) => {
            content += `- ${f.suggestion}\n`;
          });
        }

        setMessages((prev) => [...prev, { role: "assistant", content }]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ask-ordino", {
        body: { question, conversationHistory: messages },
      });

      if (error) {
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
