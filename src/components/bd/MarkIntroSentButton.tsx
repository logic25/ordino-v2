import { Button } from "@/components/ui/button";
import { Check, Send } from "lucide-react";
import { toast } from "sonner";
import { useMarkIntroSent } from "@/hooks/useBdComp";
import { safeFormatDate } from "@/lib/dateUtils";

export function MarkIntroSentButton({
  leadId,
  stage,
  introSentAt,
}: {
  leadId: string;
  stage: string | null;
  introSentAt: string | null;
}) {
  const mut = useMarkIntroSent();

  if (introSentAt) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
        <Check className="h-3.5 w-3.5" />
        Intro sent {safeFormatDate(introSentAt, "MMM d")}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={mut.isPending}
      onClick={() =>
        mut.mutate(
          { leadId, currentStage: stage },
          {
            onSuccess: () => toast.success("Intro marked sent"),
            onError: (e: any) => toast.error(e?.message ?? "Could not save"),
          }
        )
      }
    >
      <Send className="mr-1.5 h-3.5 w-3.5" /> Mark intro sent
    </Button>
  );
}
