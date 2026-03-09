import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search, Loader2, Pin, PinOff, Trash2, StickyNote, ChevronDown, ChevronUp,
  BookOpen, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResearchNotes, type ResearchNote } from "@/hooks/useResearchNotes";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { type BeaconSource } from "@/services/beaconApi";
import { supabase } from "@/integrations/supabase/client";

interface CodeResearchPanelProps {
  projectId: string;
  projectAddress?: string;
  filingType?: string;
}

const SUGGESTED_TOPICS = [
  "Egress requirements",
  "Sprinkler requirements",
  "Zoning compliance",
  "Fire-rated assembly",
  "Occupancy classification",
  "ADA accessibility",
  "Energy code",
  "Mechanical ventilation",
];

function ResearchCard({
  note,
  onTogglePin,
  onUpdateNotes,
  onDelete,
}: {
  note: ResearchNote;
  onTogglePin: () => void;
  onUpdateNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(!!note.notes);
  const [localNotes, setLocalNotes] = useState(note.notes || "");

  const sources = (note.sources || []) as BeaconSource[];

  return (
    <Card className={cn("p-4 space-y-3", note.is_pinned && "border-primary/30 bg-primary/5")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-sm font-medium leading-tight">{note.query}</p>
          </div>
          {note.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {note.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePin}>
            {note.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNotes(!showNotes)}>
            <StickyNote className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Response */}
      {note.response && (
        <div className={cn("text-sm text-foreground leading-relaxed whitespace-pre-wrap", !expanded && "line-clamp-4")}>
          {note.response}
        </div>
      )}
      {note.response && note.response.length > 300 && (
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
        </Button>
      )}

      {/* Source type indicator */}
      {note.source_type && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 w-fit",
            note.source_type === "beacon_rag" && "border-emerald-500/40 text-emerald-600",
            note.source_type === "llm" && "border-blue-500/40 text-blue-600",
            note.source_type === "hybrid" && "border-amber-500/40 text-amber-600",
          )}
        >
          {note.source_type === "beacon_rag" ? "Beacon KB" : note.source_type === "llm" ? "AI Knowledge" : "Hybrid"}
        </Badge>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
          {sources.map((s, i) => (
            <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{s.title}</span>
              {s.score > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{Math.round(s.score * 100)}%</Badge>}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {showNotes && (
        <div className="space-y-1.5 pt-1 border-t">
          <Textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Add your notes..."
            className="min-h-[60px] text-xs resize-none"
          />
          {localNotes !== (note.notes || "") && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onUpdateNotes(localNotes)}>
              Save Notes
            </Button>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {note.created_by_name && <span className="font-medium">{note.created_by_name}</span>}
        {note.created_by_name && <span>·</span>}
        <span>{new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </Card>
  );
}

export function CodeResearchPanel({ projectId, projectAddress, filingType }: CodeResearchPanelProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { notes, isLoading, create, update, remove, isCreating } = useResearchNotes(projectId);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id || "";
  const userName = profile?.display_name || profile?.first_name || "User";

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) return;

    setSearching(true);
    try {
      const prompt = `Answer this NYC building code research question directly in plain text. No markdown, no bold, no asterisks, no emojis, no headers. Just clear, factual paragraphs citing specific code sections.

Question: ${q}
Property: ${projectAddress || "N/A"}
Filing Type: ${filingType || "N/A"}`;

      const res = await askBeacon(prompt, userId, userName, {
        projectId,
        projectAddress,
        filingType,
      });

      const responseText = (res.response || "")
        .replace(/#{1,6}\s*/g, "")
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
        .replace(/^[-*>]\s+/gm, "")
        .replace(/^---+$/gm, "")
        .replace(/⚠️|✅|❌|📌|🔹|🔸|➡️|📧/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      await create({
        query: q,
        response: responseText,
        sources: res.sources || [],
        confidence: res.confidence,
      });

      setQuery("");
      toast({ title: "Research saved" });
    } catch {
      toast({ title: "Research failed", description: "Could not get a response. Try again.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleTogglePin = async (note: ResearchNote) => {
    try {
      await update({ id: note.id, is_pinned: !note.is_pinned });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleUpdateNotes = async (id: string, noteText: string) => {
    try {
      await update({ id, notes: noteText });
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this research note?")) return;
    try {
      await remove(id);
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-4 border-b space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Ask a code research question..."
              className="pl-9 h-10"
              disabled={searching}
            />
          </div>
          <Button onClick={() => handleSearch()} disabled={!query.trim() || searching} className="h-10">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Research"}
          </Button>
        </div>

        {/* Suggested topics */}
        {notes.length === 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {SUGGESTED_TOPICS.map((topic) => (
              <Button
                key={topic}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setQuery(topic); handleSearch(topic); }}
                disabled={searching}
              >
                {topic}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {searching && (
            <Card className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Researching with Beacon...
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 && !searching ? (
            <div className="text-center py-12 space-y-2">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No research notes yet</p>
              <p className="text-xs text-muted-foreground/60">Ask a code question above to get started</p>
            </div>
          ) : (
            notes.map((note) => (
              <ResearchCard
                key={note.id}
                note={note}
                onTogglePin={() => handleTogglePin(note)}
                onUpdateNotes={(text) => handleUpdateNotes(note.id, text)}
                onDelete={() => handleDelete(note.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
