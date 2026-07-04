import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  KbGap,
  NegativeFeedback,
  PendingSuggestion,
  parseFeedbackText,
  useTeachGap,
  useDismissGap,
  useTeachFromFeedback,
  useDismissFeedback,
  useApproveSuggestionTeach,
  useRejectSuggestion,
} from "@/hooks/useBeaconTeach";

type Props =
  | { source: "gap"; gap: KbGap }
  | { source: "feedback"; feedback: NegativeFeedback }
  | { source: "suggestion"; suggestion: PendingSuggestion };

export function TeachCard(props: Props) {
  const initial = derive(props);
  const [answer, setAnswer] = useState(initial.answer);
  const [topic, setTopic] = useState(initial.topic);
  const [showBeaconAnswer, setShowBeaconAnswer] = useState(false);

  const teachGap = useTeachGap();
  const dismissGap = useDismissGap();
  const teachFromFeedback = useTeachFromFeedback();
  const dismissFeedback = useDismissFeedback();
  const approveSuggestion = useApproveSuggestionTeach();
  const rejectSuggestion = useRejectSuggestion();

  const pending =
    teachGap.isPending ||
    dismissGap.isPending ||
    teachFromFeedback.isPending ||
    dismissFeedback.isPending ||
    approveSuggestion.isPending ||
    rejectSuggestion.isPending;

  const onTeach = () => {
    if (!answer.trim()) return;
    if (props.source === "gap") {
      teachGap.mutate({ gap: props.gap, correctAnswer: answer.trim(), topic: topic.trim() || undefined });
    } else if (props.source === "feedback") {
      teachFromFeedback.mutate({
        feedback: props.feedback,
        question: initial.question,
        correctAnswer: answer.trim(),
        topic: topic.trim() || undefined,
      });
    } else {
      approveSuggestion.mutate({
        suggestion: props.suggestion,
        correctAnswer: answer.trim(),
        topic: topic.trim() || undefined,
      });
    }
  };

  const onDismiss = () => {
    if (props.source === "gap") dismissGap.mutate(props.gap.member_ids);
    else if (props.source === "feedback") dismissFeedback.mutate(props.feedback.id);
    else rejectSuggestion.mutate(props.suggestion.id);
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {initial.pill}
          {initial.timestamp && (
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(initial.timestamp), { addSuffix: true })}
            </span>
          )}
          {initial.userName && (
            <span className="text-muted-foreground">· {initial.userName}</span>
          )}
        </div>

        <div className="text-sm font-medium text-foreground">{initial.question || "—"}</div>

        {initial.beaconAnswer && (
          <div>
            <button
              type="button"
              onClick={() => setShowBeaconAnswer((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {showBeaconAnswer ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Beacon's answer
            </button>
            {showBeaconAnswer && (
              <div className="mt-1 text-xs text-muted-foreground border-l-2 border-muted pl-3 whitespace-pre-wrap">
                {initial.beaconAnswer}
              </div>
            )}
          </div>
        )}

        <Textarea
          placeholder="Correct answer for Beacon to learn"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
        />
        <div className="flex items-center gap-2">
          <Input
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="max-w-xs"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDismiss} disabled={pending}>
              {props.source === "gap" ? "Not worth answering" : "Dismiss"}
            </Button>
            <Button
              size="sm"
              onClick={onTeach}
              disabled={pending || !answer.trim()}
              className="bg-[#f59e0b] hover:bg-[#d97706] text-white"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : initial.primaryLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function derive(props: Props): {
  pill: JSX.Element;
  question: string;
  beaconAnswer: string;
  answer: string;
  topic: string;
  timestamp: string;
  userName: string;
  primaryLabel: string;
} {
  if (props.source === "gap") {
    return {
      pill: (
        <Badge variant="secondary" className="bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30">
          KB Gap · asked {props.gap.asked_count}×
        </Badge>
      ),
      question: props.gap.question,
      beaconAnswer: "",
      answer: "",
      topic: props.gap.topic ?? "",
      timestamp: props.gap.last_asked_at,
      userName: "",
      primaryLabel: "Teach Beacon",
    };
  }
  if (props.source === "feedback") {
    const parsed = parseFeedbackText(props.feedback.feedback_text);
    return {
      pill: <Badge variant="destructive">👎 Flagged</Badge>,
      question: parsed.question || props.feedback.feedback_text.slice(0, 200),
      beaconAnswer: parsed.answer,
      answer: parsed.answer,
      topic: "",
      timestamp: props.feedback.timestamp,
      userName: props.feedback.user_name ?? "",
      primaryLabel: "Approve & teach",
    };
  }
  const s = props.suggestion;
  const topics = Array.isArray(s.topics) ? s.topics : s.topics ? [s.topics] : [];
  return {
    pill: <Badge variant="secondary">Suggestion</Badge>,
    question: s.wrong_answer || "—",
    beaconAnswer: s.wrong_answer && s.correct_answer && s.wrong_answer !== s.correct_answer
      ? s.wrong_answer
      : "",
    answer: s.correct_answer ?? "",
    topic: topics[0] ?? "",
    timestamp: s.timestamp,
    userName: s.user_name ?? "",
    primaryLabel: "Approve & teach",
  };
}
