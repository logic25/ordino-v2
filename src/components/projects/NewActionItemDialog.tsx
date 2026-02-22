import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateActionItem } from "@/hooks/useActionItems";
import { useCompanyProfiles } from "@/hooks/useProfiles";
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
  const [priority, setPriority] = useState(false); // false = normal, true = urgent
  const [dueDate, setDueDate] = useState("");
  const { data: profiles = [] } = useCompanyProfiles();
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
      });
      toast({ title: "Action item created" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setPriority(false);
      setDueDate("");
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
