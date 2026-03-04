import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Merge, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/hooks/useClients";

interface MergeClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onComplete: () => void;
}

export function MergeClientsDialog({
  open,
  onOpenChange,
  clients,
  onComplete,
}: MergeClientsDialogProps) {
  const [primaryId, setPrimaryId] = useState<string>(clients[0]?.id || "");
  const [merging, setMerging] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const primary = clients.find((c) => c.id === primaryId);
  const duplicates = clients.filter((c) => c.id !== primaryId);

  const handleMerge = async () => {
    if (!primaryId || duplicates.length === 0) return;
    setMerging(true);
    try {
      const dupIds = duplicates.map((d) => d.id);
      const { error } = await supabase.rpc("merge_clients", {
        primary_id: primaryId,
        duplicate_ids: dupIds,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      toast({
        title: "Companies merged",
        description: `${duplicates.length} duplicate${duplicates.length > 1 ? "s" : ""} merged into "${primary?.name}"`,
      });
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Companies
          </DialogTitle>
          <DialogDescription>
            Select the primary record to keep. All contacts, proposals, projects, and invoices from duplicates will be moved to it.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This action cannot be undone. The duplicate records will be permanently deleted after merging.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Keep as primary:</Label>
          <RadioGroup value={primaryId} onValueChange={setPrimaryId}>
            {clients.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  primaryId === c.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}
                onClick={() => setPrimaryId(c.id)}
              >
                <RadioGroupItem value={c.id} id={c.id} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    {primaryId === c.id && (
                      <Badge variant="secondary" className="text-[10px]">Primary</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[c.email, c.phone, (c as any).client_type].filter(Boolean).join(" · ") || "No details"}
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={merging || duplicates.length === 0} variant="destructive">
            {merging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              `Merge ${duplicates.length} into "${primary?.name}"`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
