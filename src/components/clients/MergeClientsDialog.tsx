import { useState, useEffect } from "react";
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

interface ClientStats {
  contacts: number;
  proposals: number;
  projects: number;
  invoices: number;
}

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
  const [stats, setStats] = useState<Record<string, ClientStats>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch linked data counts for each client
  useEffect(() => {
    if (!open || clients.length === 0) return;
    const ids = clients.map((c) => c.id);

    async function fetchStats() {
      const [contacts, proposals, projects, invoices] = await Promise.all([
        supabase.from("client_contacts").select("client_id").in("client_id", ids),
        supabase.from("proposals").select("client_id").in("client_id", ids),
        supabase.from("projects").select("client_id").in("client_id", ids),
        supabase.from("invoices").select("client_id").in("client_id", ids),
      ]);

      const counts: Record<string, ClientStats> = {};
      for (const id of ids) {
        counts[id] = {
          contacts: (contacts.data || []).filter((r) => r.client_id === id).length,
          proposals: (proposals.data || []).filter((r) => r.client_id === id).length,
          projects: (projects.data || []).filter((r) => r.client_id === id).length,
          invoices: (invoices.data || []).filter((r) => r.client_id === id).length,
        };
      }
      setStats(counts);

      // Auto-select the one with the most data
      let bestId = ids[0];
      let bestScore = 0;
      for (const id of ids) {
        const s = counts[id];
        const score = s.contacts + s.proposals * 2 + s.projects * 3 + s.invoices * 2;
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
        }
      }
      setPrimaryId(bestId);
    }

    fetchStats();
  }, [open, clients]);

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

  function renderStats(clientId: string) {
    const s = stats[clientId];
    if (!s) return null;
    const parts: string[] = [];
    if (s.projects > 0) parts.push(`${s.projects} project${s.projects > 1 ? "s" : ""}`);
    if (s.proposals > 0) parts.push(`${s.proposals} proposal${s.proposals > 1 ? "s" : ""}`);
    if (s.invoices > 0) parts.push(`${s.invoices} invoice${s.invoices > 1 ? "s" : ""}`);
    if (s.contacts > 0) parts.push(`${s.contacts} contact${s.contacts > 1 ? "s" : ""}`);
    if (parts.length === 0) return <span className="text-muted-foreground/60 italic">No linked data</span>;
    return <span className="text-foreground/70">{parts.join(" · ")}</span>;
  }

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
                    {[c.email, c.phone, (c as any).client_type].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="text-xs mt-0.5">
                    {renderStats(c.id)}
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
