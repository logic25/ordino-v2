import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2, Loader2, Lock } from "lucide-react";
import { useLeadStatuses, useCreateLeadStatus, useDeleteLeadStatus } from "@/hooks/useLeadStatuses";
import { useToast } from "@/hooks/use-toast";

const VARIANT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
  { value: "destructive", label: "Destructive" },
];

export function LeadStatusSettings() {
  const { toast } = useToast();
  const { data: statuses = [], isLoading } = useLeadStatuses();
  const createStatus = useCreateLeadStatus();
  const deleteStatus = useDeleteLeadStatus();

  const [newLabel, setNewLabel] = useState("");
  const [newVariant, setNewVariant] = useState("default");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    const value = newLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    try {
      await createStatus.mutateAsync({ label: newLabel.trim(), value, variant: newVariant });
      setNewLabel("");
      setNewVariant("default");
      toast({ title: "Lead status added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteStatus.mutateAsync(deleteId);
      setDeleteId(null);
      toast({ title: "Lead status deleted" });
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
          <CardTitle>Lead Statuses</CardTitle>
          <CardDescription>
            Define the stages a lead moves through — from initial contact to conversion or loss
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New status name..."
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Select value={newVariant} onValueChange={setNewVariant}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANT_OPTIONS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim() || createStatus.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {statuses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No lead statuses configured yet.
            </p>
          ) : (
            <div className="space-y-2">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={status.variant as any}>{status.label}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{status.value}</span>
                    {status.is_system && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!status.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(status.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
            <AlertDialogTitle>Delete Lead Status?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this status. Existing leads with this status won't be affected.
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
