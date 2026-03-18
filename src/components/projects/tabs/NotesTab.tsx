import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function NotesTab() {
  const [manualNote, setManualNote] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; text: string; source: "ai" | "manual"; date: string }>>([
    {
      id: "ai-1",
      text: "Project is awaiting final sealed drawings from architect (promised by 02/20). Client has requested expedited timeline and overrode recommendation to wait. ACP5 asbestos inspection scheduled for 02/18 via EcoTest Labs. Pre-filing meeting with DOB examiner requested. Plan review coordination is complete — zoning and code compliance confirmed. Change Order CO-001 approved for $600 (expedited filing). CO-002 pending for lead paint survey ($450).",
      source: "ai",
      date: "02/16/2026",
    },
    {
      id: "manual-1",
      text: "Margaret is pushing hard on timeline — need to manage expectations about DOB review times. Discussed with Don about potential plan exam vs pro-cert route.",
      source: "manual",
      date: "02/14/2026",
    },
  ]);
  const { toast } = useToast();

  const addNote = () => {
    if (!manualNote.trim()) return;
    setNotes((prev) => [
      { id: `manual-${Date.now()}`, text: manualNote.trim(), source: "manual", date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) },
      ...prev,
    ]);
    setManualNote("");
    toast({ title: "Note added" });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Textarea placeholder="Add a project note..." value={manualNote} onChange={(e) => setManualNote(e.target.value)} className="min-h-[80px] text-sm" />
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={addNote} disabled={!manualNote.trim()}>
            <StickyNote className="h-3.5 w-3.5" /> Add Note
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "AI Summary", description: "AI will analyze requirements, tasks, and activity to generate a project summary." })}>
            <Sparkles className="h-3.5 w-3.5" /> Generate AI Summary
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="p-3 rounded-lg border bg-background">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={note.source === "ai" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0 gap-1">
                {note.source === "ai" ? <><Sparkles className="h-2.5 w-2.5" /> AI Summary</> : <><StickyNote className="h-2.5 w-2.5" /> Manual</>}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">{note.date}</span>
            </div>
            <p className="text-sm whitespace-pre-line">{note.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
