import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useQuickTeach } from "@/hooks/useBeaconTeach";

export function QuickTeachForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState("");
  const quickTeach = useQuickTeach();
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Pre-fill from a KB gap ("Teach" action on the KB Gaps tab).
  const prefillQuestion = searchParams.get("teachQ");
  const prefillTopic = searchParams.get("teachTopic");
  useEffect(() => {
    if (!prefillQuestion) return;
    setQuestion(prefillQuestion);
    if (prefillTopic && prefillTopic !== "uncategorized") setTopic(prefillTopic);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    answerRef.current?.focus();
    const next = new URLSearchParams(searchParams);
    next.delete("teachQ");
    next.delete("teachTopic");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillQuestion, prefillTopic]);

  const submit = async () => {
    if (!question.trim() || !answer.trim()) return;
    await quickTeach.mutateAsync({
      question: question.trim(),
      answer: answer.trim(),
      topic: topic.trim() || undefined,
    });
    setQuestion("");
    setAnswer("");
    setTopic("");
  };

  return (
    <Card ref={cardRef}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#f59e0b]" />
          Teach Beacon something new
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Question (e.g. What is our standard PW1 timeline?)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Textarea
          ref={answerRef}
          placeholder="Answer Beacon should give"
          rows={4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Input
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="max-w-xs"
          />
          <Button
            onClick={submit}
            disabled={quickTeach.isPending || !question.trim() || !answer.trim()}
            className="ml-auto bg-[#f59e0b] hover:bg-[#d97706] text-white"
          >
            {quickTeach.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Teach Beacon"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
