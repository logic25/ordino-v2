import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { BdEvent } from "@/hooks/useBdEvents";

export function EventApprovalActions({ event }: { event: BdEvent }) {
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin || event.status !== "PENDING_APPROVAL") return null;

  const myName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.display_name || "Admin";

  const notifyProposer = async (decision: "approved" | "declined", note: string) => {
    if (!event.proposed_by || event.proposed_by === profile?.id) return;
    await supabase.from("notifications").insert({
      company_id: event.company_id,
      user_id: event.proposed_by,
      type: "event_decision",
      title: `Your proposed event was ${decision}`,
      body: `${myName}${note ? ": " + note : ""}`,
      link: `/bd/events/${event.id}`,
      event_id: event.id,
    } as any);
  };

  const logActivity = async (content: string) => {
    await supabase.from("bd_activities").insert({
      company_id: event.company_id,
      event_id: event.id,
      type: "APPROVAL",
      content,
      created_by: profile?.id ?? null,
    } as any);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bd-events"] });
    qc.invalidateQueries({ queryKey: ["bd-event", event.id] });
    qc.invalidateQueries({ queryKey: ["bd-activities", "event", event.id] });
  };

  const approve = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("bd_events")
        .update({ status: "APPROVED", updated_at: new Date().toISOString() } as any)
        .eq("id", event.id);
      if (error) throw error;
      await logActivity(`Event approved by ${myName}`);
      await notifyProposer("approved", "");
      toast({ title: "Approved" });
      refresh();
    } catch (e: any) {
      toast({ title: "Approve failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const decline = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("bd_events")
        .update({ status: "SKIPPED", updated_at: new Date().toISOString() } as any)
        .eq("id", event.id);
      if (error) throw error;
      const note = reason.trim();
      await logActivity(`Event declined: ${note || "(no reason)"}`);
      await notifyProposer("declined", note);
      toast({ title: "Declined" });
      setReason(""); setDeclining(false);
      refresh();
    } catch (e: any) {
      toast({ title: "Decline failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-4 border-amber-200 bg-amber-50/50">
      <p className="text-sm font-medium mb-2">This event is pending approval.</p>
      {!declining ? (
        <div className="flex gap-2">
          <Button onClick={approve} disabled={busy} size="sm">
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
            Approve
          </Button>
          <Button onClick={() => setDeclining(true)} disabled={busy} size="sm" variant="outline">
            <X className="h-4 w-4 mr-1.5" />Decline
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Why declining? (optional)"
          />
          <div className="flex gap-2">
            <Button onClick={decline} disabled={busy} size="sm" variant="destructive">
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <X className="h-4 w-4 mr-1.5" />}
              Confirm decline
            </Button>
            <Button onClick={() => { setDeclining(false); setReason(""); }} size="sm" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
