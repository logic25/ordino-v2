import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { askBeacon, type BeaconProjectContext } from "@/services/beaconApi";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function useAskOrdino() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile } = useAuth();
  const location = useLocation();

  const ask = useCallback(async (question: string) => {
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // /readiness slash command — stays on the specialized function
      if (question.trim().toLowerCase().startsWith("/readiness")) {
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

      // Free-text questions: route through Beacon (same brain as the floating widget)
      const userId = user?.email || user?.id || "anonymous";
      const userName =
        profile?.display_name ||
        profile?.first_name ||
        user?.user_metadata?.full_name ||
        "User";

      const projectMatch = location.pathname.match(/^\/projects\/([a-f0-9-]+)/);
      const projectContext: BeaconProjectContext = {
        currentPage: location.pathname,
        ...(projectMatch && { projectId: projectMatch[1] }),
      };

      const conversationHistory = messages.slice(-5).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await askBeacon(
        question,
        userId,
        userName,
        projectContext,
        conversationHistory,
        { companyId: profile?.company_id ?? null, jurisdiction: "NYC" },
      );

      let content = res.response;
      if (res.sources && res.sources.length > 0) {
        const srcList = res.sources
          .slice(0, 3)
          .map((s) => `- ${s.title}`)
          .join("\n");
        content += `\n\n---\n**Sources:**\n${srcList}`;
      }

      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (err: any) {
      const msg = err?.message || "";
      const status = (err as any)?.context?.status;
      if (status === 429 || msg.includes("429") || msg.includes("rate")) {
        toast({ title: "Rate limited", description: "Please wait a moment and try again.", variant: "destructive" });
      } else if (status === 402) {
        toast({ title: "Credits exhausted", description: "AI credits need to be topped up.", variant: "destructive" });
      }
      let content = "Something went wrong. Please try again in a moment.";
      if (msg.includes("503") || msg.includes("unavailable")) {
        content = "The backend is temporarily unavailable. Try again in a minute.";
      } else if (msg.includes("429") || msg.includes("rate")) {
        content = "Too many requests — please wait a moment.";
      } else if (msg.includes("column") || msg.includes("does not exist")) {
        content = "I tried to look that up but used the wrong field name. Let me try again differently.";
      }
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, user, profile, location.pathname]);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, isLoading, isOpen, setIsOpen, ask, clear };
}
