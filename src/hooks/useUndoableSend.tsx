import { useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSendEmail } from "@/hooks/useGmailConnection";

const UNDO_DELAY_MS = 5000;

interface SendPayload {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html_body: string;
  reply_to_email_id?: string;
  attachments?: { filename: string; content: string; mime_type: string }[];
}

export function useUndoableSend() {
  const sendEmail = useSendEmail();
  const { toast, dismiss } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const send = useCallback(
    (payload: SendPayload, onSuccess?: () => void) => {
      cancelledRef.current = false;

      const { id } = toast({
        title: "Sending email...",
        description: `To: ${payload.to}`,
        duration: UNDO_DELAY_MS + 500,
        action: (
          <button
            onClick={() => {
              cancelledRef.current = true;
              if (timerRef.current) clearTimeout(timerRef.current);
              dismiss(id);
              toast({ title: "Send cancelled", duration: 2000 });
            }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-8 px-3 hover:bg-primary/90"
          >
            Undo
          </button>
        ),
      });

      timerRef.current = setTimeout(async () => {
        if (cancelledRef.current) return;
        dismiss(id);
        try {
          await sendEmail.mutateAsync(payload);
          toast({ title: "Email Sent", description: `Sent to ${payload.to}`, duration: 3000 });
          onSuccess?.();
        } catch (err: any) {
          toast({
            title: "Send Failed",
            description: err.message,
            variant: "destructive",
          });
        }
      }, UNDO_DELAY_MS);
    },
    [sendEmail, toast, dismiss]
  );

  return { send, isPending: sendEmail.isPending };
}
