import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FolderPlus } from "lucide-react";
import type { DocumentFolder } from "@/hooks/useDocumentFolders";
import { flattenFolders } from "@/hooks/useDocumentFolders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; parent_id?: string | null; description?: string }) => Promise<void>;
  folders: DocumentFolder[];
  defaultParentId?: string | null;
}

export function NewFolderDialog({ open, onOpenChange, onSubmit, folders, defaultParentId }: Props) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("__root__");
  const [saving, setSaving] = useState(false);

  const flatList = flattenFolders(folders);

  useEffect(() => {
    if (open) {
      setName("");
      setParentId(defaultParentId || "__root__");
    }
  }, [open, defaultParentId]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        parent_id: parentId === "__root__" ? null : parentId,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Folder Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Building Code References"
              className="mt-1"
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleSubmit(); }}
            />
          </div>
          <div>
            <Label>Location</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">— Root (Top Level)</SelectItem>
                {flatList.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {"  ".repeat(f.depth)}{"└ ".repeat(Math.min(f.depth, 1))}{f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {parentId !== "__root__" && (
              <p className="text-xs text-muted-foreground mt-1">
                ↳ Creates inside "{flatList.find((f) => f.id === parentId)?.name}"
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
