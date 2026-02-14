import { useState } from "react";
import { format } from "date-fns";
import { MessageSquarePlus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEmailNotes, useAddEmailNote, useDeleteEmailNote } from "@/hooks/useEmailNotes";

interface EmailNotesSectionProps {
  emailId: string;
}

export function EmailNotesSection({ emailId }: EmailNotesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [newNote, setNewNote] = useState("");
  const { data: notes = [], isLoading } = useEmailNotes(emailId);
  const addNote = useAddEmailNote();
  const deleteNote = useDeleteEmailNote();

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    try {
      await addNote.mutateAsync({ emailId, noteText: newNote.trim() });
      setNewNote("");
    } catch {
      // toast handled by caller
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-6 py-2 hover:bg-muted/30 transition-colors">
        <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Team Notes {notes.length > 0 && `(${notes.length})`}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-6 pb-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading notes...</p>
          ) : notes.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-muted/40 rounded-md px-3 py-2 text-sm group relative"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {note.user_name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(note.created_at), "MMM d, h:mm a")}
                      </span>
                      <button
                        onClick={() => deleteNote.mutate({ noteId: note.id, emailId })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        disabled={deleteNote.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap">
                    {note.note_text}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Textarea
              placeholder="Add a team note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="resize-none text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAdd}
              disabled={!newNote.trim() || addNote.isPending}
              className="self-end"
            >
              {addNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
