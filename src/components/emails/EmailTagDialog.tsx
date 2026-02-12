import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/useProjects";
import { useTagEmail } from "@/hooks/useEmails";
import { useToast } from "@/hooks/use-toast";

interface EmailTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailId: string;
  emailSubject?: string;
}

export function EmailTagDialog({ open, onOpenChange, emailId, emailSubject }: EmailTagDialogProps) {
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const { data: projects = [] } = useProjects();
  const tagEmail = useTagEmail();
  const { toast } = useToast();

  const filtered = projects.filter((p) => {
    const term = search.toLowerCase();
    return (
      (p.name?.toLowerCase().includes(term) ?? false) ||
      (p.project_number?.toLowerCase().includes(term) ?? false) ||
      (p.properties?.address?.toLowerCase().includes(term) ?? false)
    );
  });

  const handleSave = async () => {
    if (!projectId) return;
    try {
      await tagEmail.mutateAsync({ emailId, projectId, category, notes });
      toast({ title: "Email tagged to project" });
      onOpenChange(false);
      setProjectId("");
      setCategory("other");
      setNotes("");
      setSearch("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag to Project</DialogTitle>
          {emailSubject && (
            <p className="text-sm text-muted-foreground truncate">{emailSubject}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search Projects</Label>
            <Input
              placeholder="Search by name, number, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No projects found</p>
              ) : (
                filtered.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProjectId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                      projectId === p.id ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {p.project_number}
                    </span>
                    {p.name || p.properties?.address || "Untitled"}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="objection">🚨 Objection</SelectItem>
                <SelectItem value="agency">📋 Agency Correspondence</SelectItem>
                <SelectItem value="client">👤 Client Email</SelectItem>
                <SelectItem value="submission">📄 Document Submission</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Why is this email relevant..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!projectId || tagEmail.isPending}>
            {tagEmail.isPending ? "Saving..." : "Tag Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
