import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Pencil, X, Trash2, Loader2, ExternalLink, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PermitPlaybook } from "@/hooks/usePermitPlaybooks";
import { useUpdateSlot, useVerifySlot, useRemoveSlot, useResearchPlaybook, useApplyAIDraftToEmptySlots } from "@/hooks/usePermitPlaybooks";
import type { PlaybookQAItem } from "@/lib/permitPlaybookTemplate";
import { useToast } from "@/hooks/use-toast";

function ConfidenceDot({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const color = value >= 0.75 ? "bg-emerald-500" : value >= 0.5 ? "bg-amber-500" : "bg-rose-500";
  return (
    <span title={`Confidence ${Math.round(value * 100)}%`} className={cn("inline-block h-2 w-2 rounded-full", color)} />
  );
}

export default function QARow({
  playbook, slot, marketName, state, isCustom,
}: {
  playbook: PermitPlaybook;
  slot: PlaybookQAItem;
  marketName: string;
  state: string;
  isCustom: boolean;
}) {
  const [editing, setEditing] = useState(slot.answer === "");
  const [draft, setDraft] = useState(slot.answer);
  const updateSlot = useUpdateSlot();
  const verify = useVerifySlot();
  const remove = useRemoveSlot();
  const research = useResearchPlaybook();
  const applyDraft = useApplyAIDraftToEmptySlots();
  const { toast } = useToast();

  const save = async () => {
    if (draft === slot.answer) { setEditing(false); return; }
    await updateSlot.mutateAsync({
      playbook,
      slotId: slot.id,
      patch: {
        answer: draft,
        // Manual edit on a previously-AI slot: treat as human authored, but still unverified.
        ai_generated: false,
        source: null,
        confidence: null,
        verified: false,
        verified_at: null,
        verified_by: null,
        verified_by_name: null,
      },
    });
    setEditing(false);
  };

  const handleVerify = async () => {
    await verify.mutateAsync({ playbook, slotId: slot.id, verified: true });
    toast({ title: "Verified" });
  };
  const handleUnverify = async () => {
    await verify.mutateAsync({ playbook, slotId: slot.id, verified: false });
  };

  const handleResearchThis = async () => {
    if (slot.verified) {
      toast({ title: "Slot is verified", description: "Unverify first to overwrite.", variant: "destructive" });
      return;
    }
    try {
      const suggestions = await research.mutateAsync({ playbook, marketName, state, slotIds: [slot.id] });
      if (suggestions.length === 0 || !suggestions[0].answer) {
        toast({ title: "AI couldn't find a confident answer", description: "Try editing manually." });
        return;
      }
      await applyDraft.mutateAsync({ playbook, suggestions });
      toast({ title: "AI draft added", description: "Review and verify when ready." });
    } catch (e: any) {
      toast({ title: "Research failed", description: e?.message, variant: "destructive" });
    }
  };

  const isAIDraft = !!slot.ai_generated && !slot.verified;

  return (
    <div className={cn(
      "rounded-md border p-3 space-y-2 transition",
      slot.verified && "border-emerald-200 bg-emerald-50/40",
      isAIDraft && "border-amber-200 bg-amber-50/40",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{slot.question}</div>
          <div className="flex items-center gap-2 mt-1">
            {slot.verified ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                {slot.verified_by_name && <span className="ml-1 font-normal">· {slot.verified_by_name}</span>}
                {slot.verified_at && <span className="ml-1 font-normal">· {new Date(slot.verified_at).toLocaleDateString()}</span>}
              </Badge>
            ) : isAIDraft ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                <Sparkles className="h-3 w-3 mr-1" /> AI draft — not verified
                <ConfidenceDot value={slot.confidence} />
              </Badge>
            ) : slot.answer ? (
              <Badge variant="outline" className="bg-slate-100 text-slate-700">Unverified</Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground">Empty</Badge>
            )}
            {slot.source && (
              <a href={slot.source} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
                source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!slot.verified && slot.answer && !editing && (
            <Button size="sm" variant="default" onClick={handleVerify} disabled={verify.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verify
            </Button>
          )}
          {slot.verified && (
            <Button size="sm" variant="outline" onClick={handleUnverify} disabled={verify.isPending}>
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Unverify
            </Button>
          )}
          {!editing && (
            <Button size="icon" variant="ghost" onClick={() => { setDraft(slot.answer); setEditing(true); }} aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {!slot.verified && (
            <Button
              size="icon" variant="ghost"
              onClick={handleResearchThis}
              disabled={research.isPending || applyDraft.isPending}
              aria-label="Research with AI"
            >
              {research.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </Button>
          )}
          {isCustom && !slot.verified && (
            <Button size="icon" variant="ghost" onClick={() => remove.mutate({ playbook, slotId: slot.id })} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Enter answer…"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setDraft(slot.answer); setEditing(false); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={updateSlot.isPending}>Save</Button>
          </div>
        </div>
      ) : (
        slot.answer ? (
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{slot.answer}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No answer yet.</p>
        )
      )}
    </div>
  );
}
