import { useState } from "react";
import { Mail, Phone, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { useCreateBdActivity } from "@/hooks/useBdActivities";
import { useToast } from "@/hooks/use-toast";

/**
 * Inline action bar shown under the "Communications" counter on a lead.
 * - Email      → opens the full Compose dialog (uses the user's Gmail
 *                connection if connected, otherwise standard send). On
 *                close we log a lightweight EMAIL bd_activity so the
 *                counter on the lead reflects the outreach.
 * - Log call    → captures a quick note → CALL bd_activity.
 * - Log meeting → captures a quick note → MEETING bd_activity.
 *
 * Keeping logging manual (rather than auto-scraping Gmail history) is
 * the deliberate v1 — users get an honest count of what they tracked.
 */
export function LeadCommsActions({
  leadId,
  contactEmail,
  leadName,
}: {
  leadId: string;
  contactEmail: string | null;
  leadName: string;
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [logKind, setLogKind] = useState<null | "CALL" | "MEETING">(null);
  const [note, setNote] = useState("");
  const create = useCreateBdActivity();
  const { toast } = useToast();

  const submitLog = async () => {
    if (!logKind) return;
    await create.mutateAsync({
      filter: { leadId },
      type: logKind,
      content: note.trim() || `${logKind === "CALL" ? "Called" : "Met with"} ${leadName}`,
    });
    toast({ title: `${logKind === "CALL" ? "Call" : "Meeting"} logged` });
    setNote("");
    setLogKind(null);
  };

  const emailDisabled = !contactEmail;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 rounded-full text-xs border-slate-200 hover:bg-slate-100"
          disabled={emailDisabled}
          title={emailDisabled ? "Add an email on this lead first" : "Email this lead"}
          onClick={() => setComposeOpen(true)}
        >
          <Mail className="mr-1 h-3 w-3" /> Email
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 rounded-full text-xs border-slate-200 hover:bg-slate-100"
          onClick={() => setLogKind("CALL")}
        >
          <Phone className="mr-1 h-3 w-3" /> Log call
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 rounded-full text-xs border-slate-200 hover:bg-slate-100"
          onClick={() => setLogKind("MEETING")}
        >
          <Users className="mr-1 h-3 w-3" /> Log meeting
        </Button>
      </div>

      {composeOpen && contactEmail && (
        <ComposeEmailDialog
          open={composeOpen}
          onOpenChange={(o) => {
            setComposeOpen(o);
            if (!o) {
              // Best-effort: log that an email was drafted/sent from this lead.
              // We can't see the send result from here, so we log it as an
              // outbound EMAIL activity tagged with the recipient.
              create.mutate({
                filter: { leadId },
                type: "EMAIL",
                content: `Email composed to ${contactEmail}`,
                metadata: { to: contactEmail, source: "lead_detail_quick_action" },
              });
            }
          }}
          defaultTo={contactEmail}
          defaultSubject={`Hello from Green Light Expediting`}
        />
      )}

      <Dialog open={!!logKind} onOpenChange={(o) => !o && setLogKind(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Log {logKind === "CALL" ? "a call" : "a meeting"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              logKind === "CALL"
                ? "What did you discuss? (optional)"
                : "Where / what came of it? (optional)"
            }
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogKind(null)}>Cancel</Button>
            <Button onClick={submitLog} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Log {logKind === "CALL" ? "call" : "meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
