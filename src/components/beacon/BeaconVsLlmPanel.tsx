import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Brain, Check, Loader2, Minus, Sparkles, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  compareAnswers,
  type CompareAnswersResult,
  type CompareGenericModel,
} from "@/services/beaconApi";
import { COMPARE_QUESTIONS } from "./compareQuestions";

const MODEL_LABELS: Record<CompareGenericModel, string> = {
  "openai/gpt-5.5": "GPT-5.5 (frontier)",
  "google/gemini-2.5-pro": "Gemini 2.5 Pro (frontier)",
};

function HonestyBanner() {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="text-xs">
        <strong>Coverage signal, not a correctness proof.</strong> "Beacon cited sources and the
        generic model didn't" shows that our knowledge base had relevant material — it does not
        prove the answer is right. Correctness still needs an expert review (the separate
        first-pass backtest).
      </AlertDescription>
    </Alert>
  );
}

function ModeNote({ mode }: { mode: string }) {
  if (mode !== "kb-off") return null;
  return (
    <Alert>
      <Minus className="h-4 w-4" />
      <AlertDescription className="text-xs">
        <strong>KB-off control — an approximation.</strong> Beacon's chat endpoint has no
        "knowledge base off" switch yet, so this runs a strong frontier model with no retrieval as
        the control. It is <em>not</em> Beacon's exact model with the KB disabled, so part of the
        gap may be the model rather than the knowledge base. A true same-model A/B needs a
        <code className="mx-1">kb:false</code> flag on Beacon's <code>/api/chat</code>; this view
        will use it the moment it exists.
      </AlertDescription>
    </Alert>
  );
}

function AnswerCard({
  title, subtitle, icon, answer, meta, error, accent,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  answer: string;
  meta: React.ReactNode;
  error: string | null;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-[#f59e0b]/40" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer || "—"}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-xs text-muted-foreground">
          {meta}
        </div>
      </CardContent>
    </Card>
  );
}

function WhatBeaconAdds({ result }: { result: CompareAnswersResult }) {
  const sources = result.beacon.sources ?? [];
  const only = result.delta.onlyBeaconSpecifics;
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What Beacon adds
        </p>
        {sources.length > 0 ? (
          <p className="text-sm">
            Cited <strong>{sources.length}</strong> GLE knowledge {sources.length === 1 ? "source" : "sources"}:{" "}
            {sources.map((s) => s.title).join(" · ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Beacon cited no knowledge-base sources for this question — a KB gap, not a win.
          </p>
        )}
        {only.length > 0 ? (
          <p className="text-sm">
            Named {only.length} specific{only.length === 1 ? "" : "s"} the generic model didn't:{" "}
            <span className="font-mono text-xs">{only.slice(0, 12).join(", ")}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No concrete forms, code sections, fees, or timelines that the generic model missed.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          The generic model cited nothing — it has no access to GLE knowledge by design.
        </p>
      </CardContent>
    </Card>
  );
}

function SingleQuestion({ model, mode }: { model: CompareGenericModel; mode: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareAnswersResult | null>(null);
  const { toast } = useToast();

  const run = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      setResult(await compareAnswers(question.trim(), model));
    } catch (e) {
      toast({
        title: "Comparison failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ModeNote mode={mode} />
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) run(); }}
          placeholder="Ask a real GLE question — e.g. When is a TR8 required instead of a TR1?"
        />
        <Button onClick={run} disabled={loading || !question.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">
          Running both sides in parallel — frontier reasoning models can take a minute.
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AnswerCard
              accent
              title="Beacon (KB-grounded)"
              subtitle="Answers using Green Light's knowledge base"
              icon={<Brain className="h-4 w-4 text-[#f59e0b]" />}
              answer={result.beacon.answer}
              error={result.beacon.error}
              meta={
                <>
                  <Badge variant="secondary" className="text-xs">
                    {result.beacon.sources?.length ?? 0} sources
                  </Badge>
                  {result.beacon.confidence != null && (
                    <span>confidence {result.beacon.confidence.toFixed(2)}</span>
                  )}
                  {result.beacon.response_time_ms != null && (
                    <span>{(result.beacon.response_time_ms / 1000).toFixed(1)}s</span>
                  )}
                </>
              }
            />
            <AnswerCard
              title={mode === "kb-off" ? "KB-off control (no retrieval)" : "Frontier AI (no GLE knowledge)"}
              subtitle={MODEL_LABELS[model]}
              icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
              answer={result.generic.answer}
              error={result.generic.error}
              meta={
                <>
                  <Badge variant="outline" className="text-xs">no sources</Badge>
                  {result.generic.response_time_ms != null && (
                    <span>{(result.generic.response_time_ms / 1000).toFixed(1)}s</span>
                  )}
                </>
              }
            />
          </div>
          <WhatBeaconAdds result={result} />
        </div>
      )}
    </div>
  );
}

function Scoreboard({ model, mode }: { model: CompareGenericModel; mode: string }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [rows, setRows] = useState<CompareAnswersResult[]>([]);
  const { toast } = useToast();

  const run = async () => {
    setRunning(true);
    setRows([]);
    setDone(0);
    const collected: CompareAnswersResult[] = [];
    for (const q of COMPARE_QUESTIONS) {
      try {
        const res = await compareAnswers(q, model);
        collected.push(res);
        setRows([...collected]);
      } catch (e) {
        toast({
          title: "Run stopped",
          description: (e as Error).message,
          variant: "destructive",
        });
        break;
      } finally {
        setDone((d) => d + 1);
      }
    }
    setRunning(false);
  };

  const withSources = rows.filter((r) => (r.beacon.sources?.length ?? 0) > 0).length;
  const pct = rows.length ? Math.round((withSources / rows.length) * 100) : 0;
  const specificsDelta = rows.reduce((sum, r) => sum + r.delta.onlyBeaconSpecifics.length, 0);

  return (
    <div className="space-y-4">
      <ModeNote mode={mode} />
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Run {COMPARE_QUESTIONS.length} benchmark questions
        </Button>
        {running && (
          <div className="flex-1 flex items-center gap-2">
            <Progress value={(done / COMPARE_QUESTIONS.length) * 100} className="h-2" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {done}/{COMPARE_QUESTIONS.length}
            </span>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <Card className="border-[#f59e0b]/40">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{pct}%</p>
              <p className="text-sm text-muted-foreground">
                Beacon cited real GLE knowledge on {withSources} of {rows.length} questions the
                generic model answered with no sources at all.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Beacon also named <strong>{specificsDelta}</strong> concrete forms, code sections,
                fees, or timelines that the generic model didn't.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-32">Beacon sources</TableHead>
                    <TableHead className="w-32">Generic sources</TableHead>
                    <TableHead className="w-40">Specifics only Beacon named</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.question}</TableCell>
                      <TableCell>
                        {(r.beacon.sources?.length ?? 0) > 0 ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            {r.beacon.sources.length}
                          </span>
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.delta.onlyBeaconSpecifics.length
                          ? r.delta.onlyBeaconSpecifics.slice(0, 4).join(", ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function BeaconVsLlmPanel() {
  const [model, setModel] = useState<CompareGenericModel>("openai/gpt-5.5");
  const [mode, setMode] = useState("frontier");

  return (
    <div className="space-y-4">
      <HonestyBanner />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="h-8">
            <TabsTrigger value="frontier" className="text-xs h-7">
              Beacon vs frontier model
            </TabsTrigger>
            <TabsTrigger value="kb-off" className="text-xs h-7">
              KB-off control
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={model} onValueChange={(v) => setModel(v as CompareGenericModel)}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai/gpt-5.5">{MODEL_LABELS["openai/gpt-5.5"]}</SelectItem>
            <SelectItem value="google/gemini-2.5-pro">
              {MODEL_LABELS["google/gemini-2.5-pro"]}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="h-8">
          <TabsTrigger value="single" className="text-xs h-7">Ask one question</TabsTrigger>
          <TabsTrigger value="scoreboard" className="text-xs h-7">Scoreboard</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-4">
          <SingleQuestion model={model} mode={mode} />
        </TabsContent>
        <TabsContent value="scoreboard" className="mt-4">
          <Scoreboard model={model} mode={mode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
