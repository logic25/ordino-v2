import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StickyNote, Sparkles, Loader2, Trash2, Tag, MessageSquareWarning, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface NotesTabProps {
  projectId?: string;
}

interface ProjectService {
  id: string;
  name: string;
}

interface ProjectNote {
  id: string;
  body: string;
  source: "manual" | "ai_weekly" | "ai_on_demand";
  created_at: string;
  user_id: string | null;
  service_id: string | null;
}

const GENERAL = "__general__";

export function NotesTab({ projectId }: NotesTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [manualNote, setManualNote] = useState("");
  const [composerServiceId, setComposerServiceId] = useState<string>(GENERAL);
  const [filterServiceId, setFilterServiceId] = useState<string>("all");
  const [correctingNoteId, setCorrectingNoteId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");

  const { data: services = [] } = useQuery({
    queryKey: ["project-services-for-notes", projectId],
    queryFn: async () => {
      if (!projectId) return [] as ProjectService[];
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectService[];
    },
    enabled: !!projectId,
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["project-notes", projectId],
    queryFn: async () => {
      if (!projectId) return [] as ProjectNote[];
      const { data, error } = await supabase
        .from("project_notes")
        .select("id, body, source, created_at, user_id, service_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectNote[];
    },
    enabled: !!projectId,
  });

  const serviceNameById = useMemo(() => {
    const m = new Map<string, string>();
    services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [services]);

  const filteredNotes = useMemo(() => {
    if (filterServiceId === "all") return notes;
    if (filterServiceId === GENERAL) return notes.filter((n) => !n.service_id);
    return notes.filter((n) => n.service_id === filterServiceId);
  }, [notes, filterServiceId]);

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
        service_id: composerServiceId === GENERAL ? null : composerServiceId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setManualNote("");
      setComposerServiceId(GENERAL);
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
      toast({ title: "Note added" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save note", description: e.message, variant: "destructive" }),
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
    onError: (e: any) =>
      toast({ title: "Could not generate summary", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
    onError: (e: any) =>
      toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  const correctionMutation = useMutation({
    mutationFn: async ({ noteId, text }: { noteId: string; text: string }) => {
      if (!projectId) throw new Error("Missing project");
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      if (!prof?.company_id) throw new Error("No company");
      const { error } = await supabase.from("ai_feedback").insert({
        project_id: projectId,
        company_id: prof.company_id,
        user_id: userRes.user.id,
        source_id: noteId,
        correction_text: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCorrectingNoteId(null);
      setCorrectionText("");
      toast({ title: "Correction saved", description: "Future AI summaries will incorporate this." });
    },
    onError: (e: any) =>
      toast({ title: "Could not save correction", description: e.message, variant: "destructive" }),
  });

  if (!projectId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Project notes are unavailable for this view.
      </div>
    );
  }

  const renderSourceBadge = (source: ProjectNote["source"]) => {
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

  const renderServiceBadge = (serviceId: string | null) => {
    if (!serviceId) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/40">
          General
        </Badge>
      );
    }
    const name = serviceNameById.get(serviceId) || "Service";
    return (
      <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">
        <Tag className="h-2.5 w-2.5" />
        {name}
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
        <div className="flex flex-wrap items-center gap-2">
          <Select value={composerServiceId} onValueChange={setComposerServiceId}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Service (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL}>General (project-wide)</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => addMutation.mutate(manualNote.trim())}
            disabled={!manualNote.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <StickyNote className="h-3.5 w-3.5" />
            )}
            Add Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => summaryMutation.mutate()}
            disabled={summaryMutation.isPending}
          >
            {summaryMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate AI Summary
          </Button>
        </div>
      </div>

      <Separator />

      {services.length > 0 && notes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterServiceId("all")}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              filterServiceId === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterServiceId(GENERAL)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              filterServiceId === GENERAL
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            General
          </button>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterServiceId(s.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                filterServiceId === s.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading notes...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          {notes.length === 0
            ? "No notes yet. Add context for your team, or generate an AI summary to capture current status."
            : "No notes match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => {
            const isAi = note.source !== "manual";
            const isCorrecting = correctingNoteId === note.id;
            return (
            <div key={note.id} className="p-3 rounded-lg border bg-background group">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {renderSourceBadge(note.source)}
                {renderServiceBadge(note.service_id)}
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </span>
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  {isAi && !isCorrecting && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 gap-1 text-[10px]"
                      onClick={() => {
                        setCorrectingNoteId(note.id);
                        setCorrectionText("");
                      }}
                      title="This summary is wrong — tell the AI what was actually true"
                    >
                      <MessageSquareWarning className="h-3 w-3" />
                      Correct
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => deleteMutation.mutate(note.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-line">{note.body}</p>
              {isCorrecting && (
                <div className="mt-3 space-y-2 p-3 rounded border bg-muted/40">
                  <div className="text-[11px] text-muted-foreground">
                    What was actually true? Future AI summaries on this project will treat your correction as ground truth.
                  </div>
                  <Textarea
                    autoFocus
                    placeholder="e.g. The architect is on extended leave through July — not unresponsive."
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        correctionMutation.mutate({ noteId: note.id, text: correctionText.trim() })
                      }
                      disabled={!correctionText.trim() || correctionMutation.isPending}
                    >
                      {correctionMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Save correction
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setCorrectingNoteId(null);
                        setCorrectionText("");
                      }}
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
