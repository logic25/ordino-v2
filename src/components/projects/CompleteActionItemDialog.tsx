import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Camera, Clock } from "lucide-react";
import { useCompleteActionItem, type ActionItem } from "@/hooks/useActionItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  item: ActionItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompleteActionItemDialog({ item, open, onOpenChange }: Props) {
  const [note, setNote] = useState("");
  const [hours, setHours] = useState("");
  const [timeDescription, setTimeDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const completeMutation = useCompleteActionItem();
  const { profile } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!hours || Number(hours) <= 0) {
      toast({ title: "Hours required", description: "Please enter the time spent on this task.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let attachments: { name: string; storage_path: string }[] = [];

      if (files.length > 0 && profile?.company_id) {
        for (const file of files) {
          const ext = file.name.split(".").pop();
          const path = `${profile.company_id}/${item.project_id}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("action-item-attachments").upload(path, file);
          if (error) throw error;
          attachments.push({ name: file.name, storage_path: path });
        }
      }

      await completeMutation.mutateAsync({
        id: item.id,
        project_id: item.project_id,
        completion_note: note.trim() || undefined,
        completion_attachments: attachments.length > 0 ? attachments : undefined,
        time_entry: {
          hours: Number(hours),
          description: timeDescription.trim() || item.title,
          billable,
        },
      });

      toast({ title: "Task completed" });
      onOpenChange(false);
      setNote("");
      setHours("");
      setTimeDescription("");
      setBillable(true);
      setFiles([]);
    } catch {
      toast({ title: "Error completing task", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete: {item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Time entry — required */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Log Your Time
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comp-hours" className="text-xs">Hours Spent *</Label>
                <Input
                  id="comp-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  placeholder="e.g. 1.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex items-center gap-2 h-8">
                  <Switch
                    id="comp-billable"
                    checked={billable}
                    onCheckedChange={setBillable}
                  />
                  <Label htmlFor="comp-billable" className="text-xs">Billable</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-time-desc" className="text-xs">Description</Label>
              <Input
                id="comp-time-desc"
                placeholder={item.title}
                value={timeDescription}
                onChange={(e) => setTimeDescription(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Completion note — optional */}
          <div className="space-y-1.5">
            <Label htmlFor="comp-note">What did you do? (optional)</Label>
            <Textarea
              id="comp-note"
              placeholder="Add a note about what was done..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-files">Attach photo or file (optional)</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => document.getElementById("comp-files")?.click()}
              >
                <Camera className="h-3.5 w-3.5" /> Upload
              </Button>
              {files.length > 0 && (
                <span className="text-xs text-muted-foreground">{files.length} file(s) selected</span>
              )}
            </div>
            <Input
              id="comp-files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={uploading || completeMutation.isPending || !hours || Number(hours) <= 0}>
            {uploading ? "Uploading..." : "Mark Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
