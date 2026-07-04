import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useQuickTeach } from "@/hooks/useBeaconTeach";

export function QuickTeachForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState("");
  const quickTeach = useQuickTeach();

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
    <Card>
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
