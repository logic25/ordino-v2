import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PauseCircle, PlayCircle, Loader2, ChevronDown } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export type WaitingOn = "us" | "client" | "agency" | "partner" | "none";

const LABELS: Record<WaitingOn, string> = {
  us: "Ball in our court",
  client: "Waiting on client",
  agency: "Waiting on agency",
  partner: "Waiting on partner",
  none: "No blockers",
};

interface Props {
  projectId: string;
  waitingOn: WaitingOn | null | undefined;
  waitingSince: string | null | undefined;
  waitingNote: string | null | undefined;
}

export function WaitingOnToggle({ projectId, waitingOn, waitingSince, waitingNote }: Props) {
  const current = (waitingOn || "us") as WaitingOn;
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(waitingNote || "");
  const [pendingState, setPendingState] = useState<WaitingOn | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const apply = async (next: WaitingOn, note?: string | null) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { waiting_on: next };
      if (note !== undefined) payload.waiting_note = note;
      if (next === "us" || next === "none") payload.waiting_note = null;
      const { error } = await supabase.from("projects").update(payload as any).eq("id", projectId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["projects"] });
      await qc.invalidateQueries({ queryKey: ["projects", projectId] });
      await qc.invalidateQueries({ queryKey: ["my-projects-dashboard"] });
      toast({ title: LABELS[next] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isBlocked = current !== "us" && current !== "none";
  const ageLabel = waitingSince && isBlocked
    ? formatDistanceToNowStrict(new Date(waitingSince), { addSuffix: false })
    : null;

  const handlePick = (next: WaitingOn) => {
    if (next === "client" || next === "agency" || next === "partner") {
      setPendingState(next);
      setNoteDraft(waitingNote || "");
      setNoteOpen(true);
    } else {
      apply(next);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant={isBlocked ? "secondary" : "outline"}
            className="gap-1.5 h-7"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isBlocked ? (
              <PauseCircle className="h-3.5 w-3.5" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">
              {LABELS[current]}
              {ageLabel && ` · ${ageLabel}`}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => apply("us")}>Ball in our court</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePick("client")}>Waiting on client</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePick("agency")}>Waiting on agency</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePick("partner")}>Waiting on partner</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => apply("none")}>No blockers</DropdownMenuItem>
          {waitingNote && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Note: {waitingNote}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What are you waiting on? (optional)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="waiting-note">Note</Label>
            <Input
              id="waiting-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="e.g. Signed PIS, payment, drawings…"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (pendingState) await apply(pendingState, noteDraft.trim() || null);
                setNoteOpen(false);
                setPendingState(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
