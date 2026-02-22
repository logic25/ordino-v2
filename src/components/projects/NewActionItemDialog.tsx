import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip } from "lucide-react";
import { useCreateActionItem } from "@/hooks/useActionItems";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useUniversalDocuments } from "@/hooks/useUniversalDocuments";
import { useToast } from "@/hooks/use-toast";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewActionItemDialog({ projectId, open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: documents = [] } = useUniversalDocuments();
  const createMutation = useCreateActionItem();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      await createMutation.mutateAsync({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        assigned_to: assignedTo || undefined,
        priority: priority ? "urgent" : "normal",
        due_date: dueDate || undefined,
        attachment_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });
      toast({ title: "Action item created" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setPriority(false);
      setDueDate("");
      setSelectedDocIds([]);
      setShowDocPicker(false);
    } catch {
      toast({ title: "Error creating action item", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Action Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-title">Title *</Label>
            <Input id="ai-title" placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-desc">Description</Label>
            <Textarea id="ai-desc" placeholder="Additional details or instructions..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-urgent" className="cursor-pointer">Urgent</Label>
            <Switch id="ai-urgent" checked={priority} onCheckedChange={setPriority} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-due">Due date</Label>
            <Input id="ai-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowDocPicker(!showDocPicker)}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach Documents {selectedDocIds.length > 0 && `(${selectedDocIds.length})`}
            </Button>
            {showDocPicker && documents.length > 0 && (
              <ScrollArea className="h-36 rounded-md border p-2">
                {documents.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedDocIds.includes(doc.id)}
                      onCheckedChange={(checked) => {
                        setSelectedDocIds(prev =>
                          checked ? [...prev, doc.id] : prev.filter(id => id !== doc.id)
                        );
                      }}
                    />
                    <span className="truncate">{doc.title || doc.filename}</span>
                  </label>
                ))}
              </ScrollArea>
            )}
            {showDocPicker && documents.length === 0 && (
              <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
