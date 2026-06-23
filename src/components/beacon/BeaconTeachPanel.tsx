import { Loader2, CheckCircle2, AlertCircle, MessageSquare, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuickTeachForm } from "./QuickTeachForm";
import { TeachCard } from "./TeachCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useKbGaps,
  useNegativeFeedback,
  usePendingSuggestionsForTeach,
} from "@/hooks/useBeaconTeach";

export function BeaconTeachPanel() {
  const gaps = useKbGaps();
  const feedback = useNegativeFeedback();
  const suggestions = usePendingSuggestionsForTeach();

  const loading = gaps.isLoading || feedback.isLoading || suggestions.isLoading;
  const error = gaps.error || feedback.error || suggestions.error;

  const gapCount = gaps.data?.length ?? 0;
  const fbCount = feedback.data?.length ?? 0;
  const sgCount = suggestions.data?.length ?? 0;
  const total = gapCount + fbCount + sgCount;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30">
          {gapCount} gap{gapCount === 1 ? "" : "s"}
        </Badge>
        <Badge variant="destructive">{fbCount} flagged</Badge>
        <Badge variant="secondary">{sgCount} suggestion{sgCount === 1 ? "" : "s"}</Badge>
      </div>

      <QuickTeachForm />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Failed to load review queue:{" "}
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!loading && !error && total === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-[hsl(142,71%,45%)]" />
            Nothing to review — Beacon's caught up 🎉
          </CardContent>
        </Card>
      )}

      {!loading && !error && gapCount > 0 && (
        <Section
          icon={<Lightbulb className="h-4 w-4 text-[#f59e0b]" />}
          title="KB Gaps"
          subtitle="Questions Beacon couldn't answer — fill these in"
          count={gapCount}
        >
          {gaps.data!.map((g) => (
            <TeachCard key={`gap-${g.id}`} source="gap" gap={g} />
          ))}
        </Section>
      )}

      {!loading && !error && fbCount > 0 && (
        <Section
          icon={<MessageSquare className="h-4 w-4 text-destructive" />}
          title="Flagged Answers"
          subtitle="Beacon was wrong — correct it"
          count={fbCount}
        >
          {feedback.data!.map((f) => (
            <TeachCard key={`fb-${f.id}`} source="feedback" feedback={f} />
          ))}
        </Section>
      )}

      {!loading && !error && sgCount > 0 && (
        <Section
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
          title="Pending Suggestions"
          subtitle="Proposed corrections — approve or dismiss"
          count={sgCount}
        >
          {suggestions.data!.map((s) => (
            <TeachCard key={`sg-${s.id}`} source="suggestion" suggestion={s} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="outline">{count}</Badge>
        <span className="text-xs text-muted-foreground">— {subtitle}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
