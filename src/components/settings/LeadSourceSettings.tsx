import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useLeadSources, useCreateLeadSource, useUpdateLeadSource, useDeleteLeadSource } from "@/hooks/useLeadSources";
import { useToast } from "@/hooks/use-toast";

export function LeadSourceSettings() {
  const { toast } = useToast();
  const { data: sources = [], isLoading } = useLeadSources();
  const createSource = useCreateLeadSource();
  const updateSource = useUpdateLeadSource();
  const deleteSource = useDeleteLeadSource();

  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createSource.mutateAsync({ name: newName.trim() });
      setNewName("");
      toast({ title: "Lead source added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateSource.mutateAsync({ id, is_active: !isActive });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSource.mutateAsync(deleteId);
      setDeleteId(null);
      toast({ title: "Lead source deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lead Sources</CardTitle>
          <CardDescription>
            Define how clients and prospects find your company (e.g., Referral, Website, DOB NOW, Trade Show)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New lead source name..."
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createSource.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* List */}
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No lead sources configured yet. Add some to track where your clients come from.
            </p>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{source.name}</span>
                    {!source.is_active && (
                      <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={source.is_active}
                      onCheckedChange={() => handleToggle(source.id, source.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(source.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead Source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this lead source. Existing records referencing it won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
