import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Check, X, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { PermitPlaybook, AISuggestion } from "@/hooks/usePermitPlaybooks";
import { useApplyAIDraftToEmptySlots } from "@/hooks/usePermitPlaybooks";
import { useToast } from "@/hooks/use-toast";

export default function EnrichDiffDialog({
  open, onOpenChange, playbook, suggestions, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playbook: PermitPlaybook;
  suggestions: AISuggestion[];
  loading: boolean;
}) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const apply = useApplyAIDraftToEmptySlots();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Default-accept every unverified slot with a non-empty AI answer.
      const next = new Set<string>();
      for (const s of suggestions) {
        const slot = playbook.qa.find((q) => q.id === s.id);
        if (!slot) continue;
        if (slot.verified) continue;
        if (s.answer && s.answer.trim()) next.add(s.id);
      }
      setAccepted(next);
    }
  }, [open, suggestions, playbook]);

  const toggle = (id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    const chosen = suggestions.filter((s) => accepted.has(s.id));
    if (chosen.length === 0) {
      onOpenChange(false);
      return;
    }
    await apply.mutateAsync({ playbook, suggestions: chosen });
    toast({ title: `Applied ${chosen.length} AI draft${chosen.length === 1 ? "" : "s"}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review AI suggestions</DialogTitle>
          <DialogDescription>
            Verified answers are locked. Accept or reject each AI draft for unverified slots.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="inline h-5 w-5 animate-spin mr-2" /> Researching…
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            {playbook.qa.map((slot) => {
              const sug = suggestions.find((s) => s.id === slot.id);
              const locked = slot.verified;
              return (
                <div key={slot.id} className={`rounded border p-3 ${locked ? "bg-muted/40" : ""}`}>
                  <div className="text-sm font-medium">{slot.question}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        Current
                        {locked && <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 ml-1"><Lock className="h-3 w-3 mr-1" />Protected</Badge>}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {slot.answer || <span className="italic text-muted-foreground">empty</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">AI suggestion</div>
                      {sug && sug.answer ? (
                        <>
                          <div className="text-sm whitespace-pre-wrap">{sug.answer}</div>
                          {sug.source && (
                            <a href={sug.source} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1 hover:underline">
                              source <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-sm italic text-muted-foreground">AI had no confident answer.</span>
                      )}
                    </div>
                  </div>

                  {!locked && sug && sug.answer && (
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        variant={accepted.has(slot.id) ? "default" : "outline"}
                        onClick={() => toggle(slot.id)}
                      >
                        {accepted.has(slot.id) ? <><Check className="h-3.5 w-3.5 mr-1" /> Accepted</> : <><X className="h-3.5 w-3.5 mr-1" /> Rejected</>}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleApply} disabled={loading || apply.isPending || accepted.size === 0}>
            {apply.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Apply {accepted.size} draft{accepted.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
