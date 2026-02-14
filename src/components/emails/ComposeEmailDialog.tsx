import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Clock } from "lucide-react";
import { useSendEmail } from "@/hooks/useGmailConnection";
import { useCreateScheduledEmail } from "@/hooks/useScheduledEmails";
import { ScheduleSendDropdown } from "./ScheduleSendDropdown";
import { useToast } from "@/hooks/use-toast";

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeEmailDialog({ open, onOpenChange }: ComposeEmailDialogProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const sendEmail = useSendEmail();
  const scheduleEmail = useCreateScheduledEmail();
  const { toast } = useToast();

  const resetForm = () => {
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setShowCcBcc(false);
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    try {
      await sendEmail.mutateAsync({
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        html_body: `<div>${body.replace(/\n/g, "<br/>")}</div>`,
      });
      toast({ title: "Email Sent", description: `Sent to ${to}` });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSchedule = async (date: Date) => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    try {
      await scheduleEmail.mutateAsync({
        emailDraft: {
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          html_body: `<div>${body.replace(/\n/g, "<br/>")}</div>`,
        },
        scheduledSendTime: date,
      });
      toast({
        title: "Email Scheduled",
        description: `Will send on ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Schedule Failed", description: err.message, variant: "destructive" });
    }
  };

  const canSend = to.trim() && subject.trim() && body.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="compose-to" className="text-xs">To</Label>
            <Input
              id="compose-to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {!showCcBcc ? (
            <button
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-primary hover:underline"
            >
              + Cc/Bcc
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-8">Cc</Label>
                <Input
                  placeholder="cc@example.com, ..."
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-8">Bcc</Label>
                <Input
                  placeholder="bcc@example.com, ..."
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="compose-subject" className="text-xs">Subject</Label>
            <Input
              id="compose-subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <ScheduleSendDropdown
              onSchedule={handleSchedule}
              disabled={!canSend || scheduleEmail.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!canSend || sendEmail.isPending}
            >
              {sendEmail.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
