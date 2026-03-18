import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const METHOD_LABELS: Record<string, string> = {
  reminder_email: "Reminder Sent",
  demand_letter: "Demand Letter",
  write_off: "Written Off",
  phone_call: "Phone Call",
  left_message: "Left Message",
  note: "Note",
  created: "Created",
  sent: "Sent",
  paid: "Paid",
};

interface FollowUpNotesSectionProps {
  followUps: any[] | undefined;
  onAddNote: (noteText: string, method: string) => Promise<void>;
}

export function FollowUpNotesSection({ followUps, onAddNote }: FollowUpNotesSectionProps) {
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteMethod, setNewNoteMethod] = useState("phone_call");
  const [savingNote, setSavingNote] = useState(false);

  const handleSave = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    try {
      await onAddNote(newNoteText.trim(), newNoteMethod);
      setNewNoteText("");
      setAddingNote(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">Follow-Up Notes</h4>
        </div>
        {!addingNote && (
          <Button variant="ghost" size="sm" onClick={() => setAddingNote(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Note
          </Button>
        )}
      </div>

      {addingNote && (
        <div className="rounded-lg border p-3 mb-3 space-y-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Method</Label>
            <Select value={newNoteMethod} onValueChange={setNewNoteMethod}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phone_call">Phone Call</SelectItem>
                <SelectItem value="left_message">Left Message (LM)</SelectItem>
                <SelectItem value="reminder_email">Email</SelectItem>
                <SelectItem value="note">General Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} placeholder="Called Rudin's office, spoke to AP dept..." rows={2} className="text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setAddingNote(false); setNewNoteText(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={savingNote || !newNoteText.trim()}>
              {savingNote && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Save Note
            </Button>
          </div>
        </div>
      )}

      {followUps && followUps.length > 0 ? (
        <div className="space-y-2">
          {followUps.map((fu) => (
            <div key={fu.id} className="rounded-md border p-2.5 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">{METHOD_LABELS[fu.contact_method || ""] || fu.contact_method}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(fu.created_at), "M/d/yyyy h:mm a")}</span>
              </div>
              {fu.notes && <p className="text-muted-foreground">{fu.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        !addingNote && <p className="text-sm text-muted-foreground">No follow-up notes yet</p>
      )}
    </section>
  );
}

export { METHOD_LABELS };
