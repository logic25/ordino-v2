import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Sparkles, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface NotesTabProps {
  projectId?: string;
}

interface ProjectNote {
  id: string;
  body: string;
  source: "manual" | "ai_weekly" | "ai_on_demand";
  created_at: string;
  user_id: string | null;
}

export function NotesTab({ projectId }: NotesTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [manualNote, setManualNote] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["project-notes", projectId],
    queryFn: async () => {
      if (!projectId) return [] as ProjectNote[];
      const { data, error } = await supabase
        .from("project_notes")
        .select("id, body, source, created_at, user_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectNote[];
    },
    enabled: !!projectId,
  });

  const addMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!projectId) throw new Error("Missing project");
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      if (!prof?.company_id) throw new Error("No company");
      const { error } = await supabase.from("project_notes").insert({
        project_id: projectId,
        company_id: prof.company_id,
        user_id: userRes.user.id,
        body,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setManualNote("");
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
      toast({ title: "Note added" });
    },
    onError: (e: any) => toast({ title: "Could not save note", description: e.message, variant: "destructive" }),
  });

  const summaryMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Missing project");
      const { data, error } = await supabase.functions.invoke("summarize-project", {
        body: { projectId, persist: true, source: "ai_on_demand" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
      toast({ title: "AI summary generated" });
    },
    onError: (e: any) => toast({ title: "Could not generate summary", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
    onError: (e: any) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  if (!projectId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Project notes are unavailable for this view.
      </div>
    );
  }

  const renderBadge = (source: ProjectNote["source"]) => {
    if (source === "manual") {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
          <StickyNote className="h-2.5 w-2.5" /> Manual
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
        <Sparkles className="h-2.5 w-2.5" />
        {source === "ai_weekly" ? "AI Weekly" : "AI Summary"}
      </Badge>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Add a project note... (visible to your whole team and used in OOO handoffs)"
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          className="min-h-[80px] text-sm"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => addMutation.mutate(manualNote.trim())}
            disabled={!manualNote.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
            Add Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => summaryMutation.mutate()}
            disabled={summaryMutation.isPending}
          >
            {summaryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate AI Summary
          </Button>
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading notes...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          No notes yet. Add context for your team, or generate an AI summary to capture current status.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg border bg-background group">
              <div className="flex items-center gap-2 mb-1.5">
                {renderBadge(note.source)}
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => deleteMutation.mutate(note.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm whitespace-pre-line">{note.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
