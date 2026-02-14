import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Copy, FileText } from "lucide-react";
import { useRfpContent, useCreateRfpContent, useUpdateRfpContent, useDeleteRfpContent } from "@/hooks/useRfpContent";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function NarrativesTab() {
  const { data: items = [], isLoading } = useRfpContent("narrative_template");
  const { data: firmHistory = [] } = useRfpContent("firm_history");
  const allItems = [...firmHistory, ...items];
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const deleteMutation = useDeleteRfpContent();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [contentType, setContentType] = useState<string>("narrative_template");

  const openNew = () => {
    setEditingId(null);
    setTitle("");
    setText("");
    setTags("all_agencies");
    setContentType("narrative_template");
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title);
    setText((item.content as any)?.text || "");
    setTags(item.tags?.join(", ") || "");
    setContentType(item.content_type);
    setDialogOpen(true);
  };

  const handleDuplicate = async (item: any) => {
    try {
      await createMutation.mutateAsync({
        content_type: item.content_type,
        title: `${item.title} (Copy)`,
        content: item.content,
        tags: item.tags,
      });
      toast({ title: "Narrative duplicated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          title,
          content: { text } as any,
          tags: tagArray,
        });
      } else {
        await createMutation.mutateAsync({
          content_type: contentType,
          title,
          content: { text } as any,
          tags: tagArray,
        });
      }
      toast({ title: editingId ? "Narrative updated" : "Narrative added" });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Narrative deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Narratives & Templates ({allItems.length})</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Narrative
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Reusable text blocks for approach statements, firm history, and other narrative sections.
        Use variables like <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{company_name}}"}</code> for auto-fill.
      </p>

      {allItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No narratives yet. Add firm history and approach templates.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="font-semibold">{item.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.content_type === "firm_history" ? "Firm History" : "Template"}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      {item.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {format(new Date(item.updated_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicate(item)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Narrative" : "Add Narrative"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Standard Firm History" />
            </div>
            <div className="space-y-1">
              <Label>Tags (comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="all_agencies, nycedc" />
            </div>
            <div className="space-y-1">
              <Label>Content</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder="Write your narrative template here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editingId ? "Save" : "Add Narrative"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
