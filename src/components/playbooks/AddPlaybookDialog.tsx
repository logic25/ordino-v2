import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useCreatePlaybook } from "@/hooks/usePermitPlaybooks";
import { COMMON_PERMIT_TYPES } from "@/lib/permitPlaybookTemplate";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AddPlaybookDialog({
  open, onOpenChange, marketId,
}: { open: boolean; onOpenChange: (v: boolean) => void; marketId: string }) {
  const [permitType, setPermitType] = useState("");
  const create = useCreatePlaybook();
  const nav = useNavigate();
  const { toast } = useToast();

  const handleCreate = async () => {
    const t = permitType.trim();
    if (!t) return;
    try {
      const row = await create.mutateAsync({ market_id: marketId, permit_type: t });
      toast({ title: "Playbook created" });
      onOpenChange(false);
      setPermitType("");
      nav(`/markets/${marketId}/playbooks/${row.id}`);
    } catch (e: any) {
      toast({
        title: "Could not create playbook",
        description: e?.message?.includes("unique") ? "A playbook for that permit type already exists in this market." : e?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New permit playbook</DialogTitle>
          <DialogDescription>
            One playbook per permit type in this jurisdiction. The standard 9 questions are pre-loaded; you can add more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="permit-type">Permit type</Label>
            <Input
              id="permit-type"
              autoFocus
              value={permitType}
              onChange={(e) => setPermitType(e.target.value)}
              placeholder="e.g. Sign Permit"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Common types:</div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_PERMIT_TYPES.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setPermitType(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!permitType.trim() || create.isPending}>
            {create.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
